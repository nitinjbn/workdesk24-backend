import { AIRequestContext } from "../types/AIRequestContext";
import userService from "../../../modules/master/services/user.service";

export interface SearchEmployeesArgs {
    search: string;
}

export interface SearchEmployeesResult {
    success: true;
    employees: Array<{
        userId: string;
        employeeCode: string | null;
        name: string;
        email: string | null;
    }>;
}

export async function handleSearchEmployees(
    args: SearchEmployeesArgs,
    context: AIRequestContext
): Promise<SearchEmployeesResult> {

    const search = args.search.trim();
    context.lastEmployeeSearchUserIds = new Set();
    context.lastEmployeeSearchMatchCount = 0;

    if (!search) {
        return {
            success: true,
            employees: [],
        };
    }

    /*
    * IMPORTANT:
    * Replace this with your existing employee/user service.
    *
    * Do NOT create a separate SQL query here if Workdesk24
    * already has an employee/user service.
    */

    const employees = await userService.searchEmployeesForAI(
        Number(context.hostId),
        search,
    );

    context.lastEmployeeSearchUserIds = new Set(
        employees.map((employee) => String(employee.id)),
    );
    context.lastEmployeeSearchMatchCount = employees.length;

    return {
        success: true,
        employees: employees.map((employee) => ({
            userId: String(employee.id),
            employeeCode: employee.employeeCode ?? null,
            name: employee.name ?? "",
            email: employee.email ?? null,
        })),
    };
}

