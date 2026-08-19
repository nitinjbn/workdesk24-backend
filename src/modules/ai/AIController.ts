import { Request, Response } from "express";
import { aiService } from "../../infrastructure/openai/AIService";
import { AIRequestContext } from "../../infrastructure/openai/types/AIRequestContext";

export class AIController {

    async chat(req: Request, res: Response): Promise<Response> {

        try {

            const { message } = req.body;

            if (
                typeof message !== "string" ||
                message.trim().length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Message is required.",
                });
            }

            /**
             * User should already be populated by
             * your authentication middleware.
             */
            const user = (req as any).user;

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized.",
                });
            }

            /**
             * IMPORTANT:
             *
             * hostId must come from the authenticated user,
             * never from req.body or the AI request.
             */
            const context: AIRequestContext = {
                userId: user.id,
                hostId: user.hostId,
                role: user.role,
                timezone: user.timezone ?? "Asia/Kolkata",
            };

            const answer = await aiService.chat(
                message.trim(),
                context
            );

            return res.status(200).json({
                success: true,
                data: {
                    answer,
                },
            });

        } catch (error) {

            console.error(
                "AI chat error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to process AI request.",
            });
        }
    }
}

export const aiController = new AIController();