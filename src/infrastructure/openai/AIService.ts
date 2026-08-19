import { openAIClient } from "./OpenAIClient";
import { randomUUID } from "crypto";
import {
    AI_TOOLS,
    AI_TOOL_HANDLERS,
} from "./AIToolRegistry";
import { ADMIN_ASSISTANT_INSTRUCTIONS } from "./prompts/admin-assistant.prompt";
import { AIRequestContext } from "./types/AIRequestContext";
import { logger } from "../../config/database";

interface SerializedMetrics {
    chars: number;
    bytes: number;
}

interface PayloadMetrics extends SerializedMetrics {
    itemCount?: number;
    itemTypes?: Record<string, number>;
    topLevelFields?: string[];
    arrayRecordCount?: number;
}

const serializeForMetrics = (value: unknown): string => {
    try {
        return JSON.stringify(value, (_key, currentValue) => {
            if (typeof currentValue === "bigint") {
                return currentValue.toString();
            }

            return currentValue;
        }) ?? "";
    } catch {
        return "[unserializable]";
    }
};

const getSerializedMetrics = (value: unknown): SerializedMetrics => {
    const serialized = serializeForMetrics(value);

    return {
        chars: serialized.length,
        bytes: Buffer.byteLength(serialized, "utf8"),
    };
};

const getArrayRecordCount = (value: unknown): number => {
    if (Array.isArray(value)) {
        return value.reduce((count, item) => count + 1 + getArrayRecordCount(item), 0);
    }

    if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>).reduce<number>(
            (count, item) => count + getArrayRecordCount(item),
            0,
        );
    }

    return 0;
};

const getPayloadMetrics = (value: unknown): PayloadMetrics => {
    const metrics = getSerializedMetrics(value);
    const isObject = value !== null && typeof value === "object" && !Array.isArray(value);

    return {
        ...metrics,
        ...(Array.isArray(value) ? { itemCount: value.length } : {}),
        ...(isObject
            ? { topLevelFields: Object.keys(value as Record<string, unknown>) }
            : {}),
        arrayRecordCount: getArrayRecordCount(value),
    };
};

const getInputMetrics = (input: unknown[]): PayloadMetrics => {
    const itemTypes: Record<string, number> = {};

    for (const item of input) {
        let itemType = "unknown";

        if (item && typeof item === "object") {
            const typedItem = item as Record<string, unknown>;
            const type = typedItem.type;
            const role = typedItem.role;

            if (typeof type === "string") {
                itemType = type;
            } else if (typeof role === "string") {
                itemType = role;
            }
        }

        itemTypes[itemType] = (itemTypes[itemType] ?? 0) + 1;
    }

    return {
        ...getPayloadMetrics(input),
        itemCount: input.length,
        itemTypes,
    };
};

const getUsageMetrics = (usage: unknown): Record<string, unknown> | null => {
    if (!usage || typeof usage !== "object") {
        return null;
    }

    const usageRecord = usage as Record<string, unknown>;
    const inputDetails = usageRecord.input_tokens_details;
    const outputDetails = usageRecord.output_tokens_details;
    const inputDetailsRecord = inputDetails && typeof inputDetails === "object"
        ? inputDetails as Record<string, unknown>
        : undefined;
    const outputDetailsRecord = outputDetails && typeof outputDetails === "object"
        ? outputDetails as Record<string, unknown>
        : undefined;

    return {
        input_tokens: usageRecord.input_tokens ?? null,
        output_tokens: usageRecord.output_tokens ?? null,
        total_tokens: usageRecord.total_tokens ?? null,
        cached_tokens: inputDetailsRecord?.cached_tokens ?? null,
        cache_write_tokens: inputDetailsRecord?.cache_write_tokens ?? null,
        reasoning_tokens: outputDetailsRecord?.reasoning_tokens ?? null,
    };
};

export class AIService {

    async chat(
        message: string,
        context: AIRequestContext
    ): Promise<string> {

        const requestId = randomUUID();
        const aiRequestStartedAt = process.hrtime.bigint();
        const instructionMetrics = getSerializedMetrics(ADMIN_ASSISTANT_INSTRUCTIONS);
        const toolSchemaMetrics = getSerializedMetrics(AI_TOOLS);
        let previousOutputMetrics: SerializedMetrics = { chars: 0, bytes: 0 };
        let pendingFunctionCallArgumentChars = 0;
        let pendingToolResultMetrics: PayloadMetrics = {
            chars: 0,
            bytes: 0,
            arrayRecordCount: 0,
        };

        let input: any[] = [
            {
                role: "user",
                content: message,
            },
        ];

        for (let iteration = 0; iteration < 10; iteration++) {

            const inputMetrics = getInputMetrics(input);
            const callStartedAt = process.hrtime.bigint();

            logger.info("AI OpenAI request diagnostics", {
                requestId,
                iteration,
                model: "gpt-5.6",
                inputMetrics: {
                    userMessageChars: message.length,
                    instructionsChars: instructionMetrics.chars,
                    instructionsBytes: instructionMetrics.bytes,
                    toolSchemaChars: toolSchemaMetrics.chars,
                    toolSchemaBytes: toolSchemaMetrics.bytes,
                    accumulatedInputChars: inputMetrics.chars,
                    accumulatedInputBytes: inputMetrics.bytes,
                    inputItemCount: inputMetrics.itemCount,
                    inputItemTypes: inputMetrics.itemTypes,
                    previousOutputChars: previousOutputMetrics.chars,
                    previousOutputBytes: previousOutputMetrics.bytes,
                    functionCallArgumentChars: pendingFunctionCallArgumentChars,
                    toolResultChars: pendingToolResultMetrics.chars,
                    toolResultBytes: pendingToolResultMetrics.bytes,
                    toolResultArrayRecordCount: pendingToolResultMetrics.arrayRecordCount,
                },
                tools: {
                    count: AI_TOOLS.length,
                    names: AI_TOOLS.map((tool) => tool.name),
                },
            });

            const response = await openAIClient.responses.create({
                model: "gpt-5.6",

                instructions: ADMIN_ASSISTANT_INSTRUCTIONS,

                tools: AI_TOOLS,

                input,
            });
            console.log("AI OpenAI response", {
                requestId,
                iteration,
                response: {
                    output: response.output,
                    output_text: response.output_text,
                    usage: response.usage,
                },
            });

            const responseOutputMetrics = getPayloadMetrics(response.output);
            const functionCalls = response.output.filter(
                (item) => item.type === "function_call"
            );
            const outputTextChars = response.output_text?.length ?? 0;
            const openAICallDurationMs = Number(
                (process.hrtime.bigint() - callStartedAt) / 1000000n,
            );

            logger.info("AI OpenAI response diagnostics", {
                requestId,
                iteration,
                outputMetrics: {
                    itemCount: responseOutputMetrics.itemCount,
                    chars: responseOutputMetrics.chars,
                    bytes: responseOutputMetrics.bytes,
                    functionCallCount: functionCalls.length,
                    functionCallArgumentChars: functionCalls.reduce(
                        (total, call) => total + call.arguments.length,
                        0,
                    ),
                    outputTextChars,
                },
                openAI: {
                    durationMs: openAICallDurationMs,
                    usage: getUsageMetrics(response.usage),
                },
            });

            input.push(...response.output);
            previousOutputMetrics = getSerializedMetrics(response.output);

            /**
             * No tool call means OpenAI has generated
             * the final response.
             */
            if (functionCalls.length === 0) {
                logger.info("AI generated final response", {
                    requestId,
                    iteration,
                    outputTextChars,
                });

                logger.info("AI request diagnostics", {
                    requestId,
                    success: true,
                    iterations: iteration + 1,
                    totalDurationMs: Number(
                        (process.hrtime.bigint() - aiRequestStartedAt) / 1000000n,
                    ),
                });

                return response.output_text;
            }

            /**
             * Execute all requested tools.
             */
            console.log("AI tool calls", {
                iteration,
                tools: functionCalls.map((call) => call.name),
            });
            for (const functionCall of functionCalls) {

                const toolName = functionCall.name;

                const handler =
                    AI_TOOL_HANDLERS[
                        toolName as keyof typeof AI_TOOL_HANDLERS
                    ];

                /**
                 * Tool is not registered.
                 */
                if (!handler) {
                    throw new Error(
                        `No handler registered for AI tool: ${toolName}`
                    );
                }

                /**
                 * Parse tool arguments generated by OpenAI.
                 */
                let args: unknown;

                try {

                    args = JSON.parse(
                        functionCall.arguments
                    );

                } catch {

                    throw new Error(
                        `Invalid arguments received for AI tool: ${toolName}`
                    );
                }

                /**
                 * Execute the actual Workdesk24 backend tool.
                 *
                 * Any service/database error is caught here
                 * so that one tool failure does not crash
                 * the complete AI conversation.
                 */
                let result: unknown;
                const toolStartedAt = process.hrtime.bigint();
                let toolSucceeded = false;
                let toolErrorCategory: string | null = null;

                try {

                    result = await handler(
                        args as never,
                        context
                    );
                    toolSucceeded = true;

                } catch (error) {

                    toolErrorCategory = "TOOL_EXECUTION";

                    logger.error("AI tool execution failed", {
                        requestId,
                        iteration,
                        toolName,
                        errorCategory: toolErrorCategory,
                    });

                    result = {
                        success: false,
                        error: "Unable to retrieve the requested data.",
                    };
                }

                const serializedResult = JSON.stringify(result) ?? "";
                const resultMetrics = getPayloadMetrics(result);
                const toolDurationMs = Number(
                    (process.hrtime.bigint() - toolStartedAt) / 1000000n,
                );

                logger.info("AI tool execution diagnostics", {
                    requestId,
                    iteration,
                    tool: {
                        name: toolName,
                        durationMs: toolDurationMs,
                        success: toolSucceeded,
                        errorCategory: toolErrorCategory,
                        resultChars: serializedResult.length,
                        resultBytes: Buffer.byteLength(serializedResult, "utf8"),
                        resultArrayRecordCount: resultMetrics.arrayRecordCount,
                        resultTopLevelFields: resultMetrics.topLevelFields,
                    },
                });

                /**
                 * Send the tool result back to OpenAI.
                 */
                input.push({
                    type: "function_call_output",
                    call_id: functionCall.call_id,
                    output: serializedResult,
                });

                pendingFunctionCallArgumentChars += functionCall.arguments.length;
                pendingToolResultMetrics = {
                    chars: pendingToolResultMetrics.chars + serializedResult.length,
                    bytes: pendingToolResultMetrics.bytes + Buffer.byteLength(serializedResult, "utf8"),
                    arrayRecordCount:
                        (pendingToolResultMetrics.arrayRecordCount ?? 0) +
                        (resultMetrics.arrayRecordCount ?? 0),
                };
            }
        }

        /**
         * Prevent infinite tool-calling loops.
         */
        logger.warn("AI request diagnostics", {
            requestId,
            success: false,
            errorCategory: "MAX_ITERATIONS",
            totalDurationMs: Number(
                (process.hrtime.bigint() - aiRequestStartedAt) / 1000000n,
            ),
        });

        throw new Error("AI tool execution exceeded maximum iterations.");
    }
}

export const aiService = new AIService();