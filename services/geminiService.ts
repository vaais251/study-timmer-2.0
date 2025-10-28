
import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Part } from "@google/genai";
import { Goal, Target, Project, Commitment, Task } from '../types';

export async function generateContent(prompt: string): Promise<string> {
    try {
        const ai = new GoogleGenAI({ apiKey: "AIzaSyBT9IN5PiyqaWBdM9NekDg5d-5fWDuhZnE" });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const text = response.text;
        
        if (text) {
            return text;
        } else {
            // This case might occur if the model returns a valid but empty response.
            console.warn("Received an empty text response from Gemini API.");
            return "The AI returned an empty response. You might want to rephrase your request.";
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `An error occurred while contacting the AI. Please check your API key and network connection. Details: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}

export interface AgentContext {
    goals: Pick<Goal, 'id' | 'text'>[];
    targets: Pick<Target, 'id' | 'text' | 'deadline' | 'completed_at'>[];
    projects: Pick<Project, 'id' | 'name' | 'description' | 'status' | 'deadline' | 'completion_criteria_type' | 'completion_criteria_value' | 'progress_value'>[];
    commitments: Pick<Commitment, 'id' | 'text' | 'due_date'>[];
    tasks: Pick<Task, 'id' | 'text' | 'due_date' | 'completed_at' | 'project_id' | 'completed_poms' | 'total_poms'>[];
    dailyLogs: { date: string; total_focus_minutes: number; completed_sessions: number }[];
}

export async function runAgent(
    history: { role: string; parts: Part[] }[],
    tools: FunctionDeclaration[],
    context: AgentContext
): Promise<GenerateContentResponse> {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyBT9IN5PiyqaWBdM9NekDg5d-5fWDuhZnE" });

    const systemInstruction = `You are PomoAI, an expert productivity coach and data analyst integrated into a Pomodoro study application. You have complete read-only access to the user's planning and performance data, which is provided below in structured format. Your primary role is to help the user understand their data, find insights, plan their work, and take action on their behalf using your available tools (like adding tasks or projects). You are conversational, encouraging, and highly analytical.

When a user asks you to perform an action (e.g., "create a task", "set up a project"), you MUST use the provided functions. After using a function, you must confirm the action in your response. For data analysis questions (e.g., "Which day was I most productive?", "How much time did I spend on project X?"), you must analyze the provided data context to give a precise answer. Do not invent data.

Today's date is ${new Date().toISOString().split('T')[0]}.

--- USER DATA SCHEMA & CONTEXT ---
The following data is for the currently selected date range.

== SCHEMA DEFINITIONS ==
- **Goal**: A high-level, long-term ambition. Fields: \`id\`, \`text\`.
- **Target**: A specific, measurable objective with a deadline. Fields: \`id\`, \`text\`, \`deadline\`, \`completed_at\`.
- **Project**: A collection of tasks. Fields: \`id\`, \`name\`, \`description\`, \`status\` ('active', 'completed', 'due'), \`deadline\`, \`completion_criteria_type\` ('manual', 'task_count', 'duration_minutes'), \`completion_criteria_value\`, \`progress_value\`.
- **Task**: An individual to-do item. Fields: \`id\`, \`text\`, \`due_date\`, \`completed_at\`, \`project_id\`, \`completed_poms\`, \`total_poms\`.
- **Commitment**: A promise or accountability statement. Fields: \`id\`, \`text\`, \`due_date\`.
- **DailyPerformanceLog**: A summary of work for a single day. Fields: \`date\`, \`total_focus_minutes\`, \`completed_sessions\` (number of pomodoros).

== CORE GOALS ==
${context.goals.map(g => `- ${g.text} (ID: ${g.id})`).join('\n') || "No core goals set."}

== KEY TARGETS ==
${context.targets.map(t => `- [${t.completed_at ? 'X' : ' '}] ${t.text} (Due: ${t.deadline}, ID: ${t.id})`).join('\n') || 'No key targets set.'}

== PROJECTS ==
${context.projects.map(p => {
    let progress = '';
    if (p.completion_criteria_type === 'task_count') progress = `(${p.progress_value}/${p.completion_criteria_value} tasks)`;
    if (p.completion_criteria_type === 'duration_minutes') progress = `(${p.progress_value}/${p.completion_criteria_value} min)`;
    return `- ${p.name} [${p.status}] ${progress} (Due: ${p.deadline || 'N/A'}, ID: ${p.id})`;
}).join('\n') || 'No projects.'}
Note: When adding a task to a project, you MUST use the project's ID.

== TASKS (within date range) ==
${context.tasks.map(t => `- [${t.completed_at ? 'X' : ' '}] ${t.text} (${t.completed_poms}/${t.total_poms} poms, Due: ${t.due_date}, ProjectID: ${t.project_id || 'None'}, ID: ${t.id})`).join('\n') || 'No tasks in this period.'}

== COMMITMENTS ==
${context.commitments.map(c => `- ${c.text} (Due: ${c.due_date || 'N/A'}, ID: ${c.id})`).join('\n') || 'No commitments made.'}

== DAILY PERFORMANCE LOGS (within date range) ==
${context.dailyLogs.map(log => `- Date: ${log.date}, Focus Time: ${log.total_focus_minutes} minutes, Pomodoros: ${log.completed_sessions}`).join('\n') || 'No focus sessions recorded in this period.'}
--- END OF CONTEXT ---

Based on this detailed data and schema, answer the user's questions and execute commands with precision.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: [{ functionDeclarations: tools }],
        }
    });

    return response;
}