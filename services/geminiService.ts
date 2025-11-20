

import { GoogleGenAI, GenerateContentResponse, FunctionDeclaration, Part, Type } from "@google/genai";
import { Goal, Target, Project, Commitment, Task, AiMemory, PomodoroHistory, DbDailyLog } from '../types';

/**
 * Initializes and returns a GoogleGenAI client instance.
 * It uses a hardcoded API key as requested.
 * Note: Hardcoding API keys in client-side code is a security risk.
 */
const getAiClient = (): GoogleGenAI => {
    const apiKey = process.env.API_KEY;
    return new GoogleGenAI({ apiKey });
};


export async function getChartInsight(chartTitle: string, chartData: any): Promise<string> {
    const prompt = `
        You are a world-class data analyst and productivity coach. Your goal is to help a user understand their study and work habits to become more productive.
        You are analyzing data from a chart in their Pomodoro timer application.

        Chart Title: "${chartTitle}"

        The data for this chart is provided below in JSON format. Analyze it thoroughly.

        Data:
        \`\`\`json
        ${JSON.stringify(chartData, null, 2)}
        \`\`\`

        Based on this data, provide a detailed analysis with actionable insights. Your analysis should be easy to read and structured with markdown.
        
        Specifically, please cover the following:
        1.  **Summary**: Start with a high-level summary of what the chart shows. What is the key takeaway?
        2.  **Trends & Patterns**: Identify any significant trends (e.g., increasing focus time, decreasing completion rate), patterns (e.g., more productive on certain days), or correlations.
        3.  **Outliers & Anomalies**: Point out any outliers, such as exceptionally productive days or unusually low-performance periods. Explain what might have caused them.
        4.  **Actionable Insights & Suggestions**: Provide concrete, actionable advice based on your analysis. For example, if focus is low on weekends, suggest planning lighter tasks. If a certain project is taking a lot of time, suggest breaking it down.
        
        Keep your tone encouraging and helpful. The user wants to improve.
    `;

    try {
        const ai = getAiClient();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text;
        
        if (text) {
            return text;
        } else {
            return "The AI returned an empty response. You might want to try again.";
        }
    } catch (error) {
        console.error("Error calling Gemini API for chart insight:", error);
        if (error instanceof Error) {
            return `An error occurred while contacting the AI. Details: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}

export async function getTabSummary(tabName: string, data: any): Promise<string> {
    const prompt = `
        You are a world-class data analyst and productivity coach. Your goal is to help a user understand their study and work habits to become more productive.
        You are analyzing data from the "${tabName}" tab in their Pomodoro timer application's statistics page.

        The data for this tab is provided below in JSON format. It may include data for multiple charts and KPIs. Analyze it holistically.

        Data:
        \`\`\`json
        ${JSON.stringify(data, null, 2)}
        \`\`\`

        Based on this data, provide a detailed summary and analysis with actionable insights. Your analysis should be easy to read and structured with markdown.
        
        Specifically, please cover the following:
        1.  **Overall Summary**: Start with a high-level summary of what this tab reveals about the user's productivity in the selected date range. What is the key story the data is telling?
        2.  **Key Trends & Patterns**: Identify the most significant trends, patterns, or correlations across all the data provided for this tab.
        3.  **Strengths & Weaknesses**: Point out areas where the user is doing well (e.g., high completion rate for priority tasks) and areas that could be improved (e.g., inconsistent focus on weekends).
        4.  **Actionable Suggestions**: Provide concrete, actionable advice based on your holistic analysis of this tab. For example, if focus is low on weekends, suggest planning lighter tasks. If a certain category is taking a lot of time but has low completion, suggest breaking down tasks within that category.
        
        Keep your tone encouraging and helpful. The user wants to improve.
    `;

    try {
        const ai = getAiClient();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text;
        
        if (text) {
            return text;
        } else {
            return "The AI returned an empty response. You might want to try again.";
        }
    } catch (error) {
        console.error("Error calling Gemini API for tab summary:", error);
        if (error instanceof Error) {
            return `An error occurred while contacting the AI. Details: ${error.message}`;
        }
        return "An unknown error occurred while contacting the AI.";
    }
}


export async function generateContent(prompt: string): Promise<string> {
    try {
        const ai = getAiClient();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // No tools for this simple utility call to avoid complexity.
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
    targets: Pick<Target, 'id' | 'text' | 'deadline' | 'completed_at' | 'priority'>[];
    projects: Pick<Project, 'id' | 'name' | 'description' | 'status' | 'start_date' | 'deadline' | 'completion_criteria_type' | 'completion_criteria_value' | 'progress_value' | 'priority' | 'active_days'>[];
    commitments: Pick<Commitment, 'id' | 'text' | 'due_date'>[];
    tasks: Pick<Task, 'id' | 'text' | 'due_date' | 'completed_at' | 'project_id' | 'completed_poms' | 'total_poms' | 'comments' | 'priority' | 'tags'>[];
    dailyLogs: DbDailyLog[];
    pomodoroHistory: Pick<PomodoroHistory, 'id' | 'task_id' | 'ended_at' | 'duration_minutes'>[];
    aiMemories: Pick<AiMemory, 'id' | 'type' | 'content' | 'tags' | 'created_at'>[];
    dateRangeDescription: string;
}

export async function runAgent(
    history: { role: string; parts: Part[] }[],
    tools: FunctionDeclaration[],
    context: AgentContext
): Promise<GenerateContentResponse> {
    const ai = getAiClient();

    const systemInstruction = `You are PomoAI, an expert productivity coach and data analyst integrated into a Pomodoro study application. You have read-only access to a snapshot of the user's planning and performance data, provided below. This snapshot covers ${context.dateRangeDescription}. Your primary role is to help the user understand their data, find insights, plan their work, and take action on their behalf using your available tools. You are conversational, encouraging, and highly analytical. The app supports two primary work modes for tasks:
1.  **Pomodoro Mode**: Traditional countdown timers for focused work sessions. These are for tasks with a defined scope, estimated in 'poms'.
2.  **Stopwatch Mode**: A flexible, open-ended timer that counts up from zero. This is ideal for tasks where the duration is unknown, like creative work or open-ended research. Time is tracked and logged as a single session when the user manually completes the task. You can identify these tasks as having a \`total_poms\` value of -1.

A key feature of the application is the **Mastery Tracker**, which helps the user visualize their long-term learning progress. The app automatically aggregates all focus time spent on tasks with specific tags (e.g., 'physics', 'coding', 'japanese'). It then presents this accumulated time as progress towards the goal of 10,000 hours of deliberate practice, a concept associated with achieving expert-level skill. You should leverage this concept when discussing long-term goals, learning, and skill development with the user. You can analyze their time distribution across different skills and suggest how they can align their daily tasks with their mastery goals.

When a user wants to try again after failing an item (e.g., a project is 'due', a commitment is 'broken', or a target is 'incomplete'), you MUST use the \`rescheduleItem\` tool. This preserves the original item as a historical record and creates a new one for them to attempt again.

You have access to a memory bank that helps you understand the user better over time. It has 3 types:
- **'learning' memories**: Specific facts or concepts the user explicitly saved via the '@learn' command after a study session. Use these to suggest future tasks or projects.
- **'personal' memories**: Personal context the user explicitly told you to save with '@personal' (e.g. "my goal is to learn japanese").
- **'ai' memories**: Context that YOU, the AI, have autonomously decided is important to remember for future conversations (e.g. user mentions struggling with motivation).

It is CRITICAL that you keep this information up-to-date and relevant.
- When the user shares new, important personal information (e.g. "my weakest subject is calculus"), you MUST use your \`saveMemory\` tool with \`type: 'personal'\` to save it.
- When you identify important context yourself from the conversation, you MUST use \`saveMemory\` with \`type: 'ai'\`.
- If the user provides new information that contradicts an old memory (e.g., "my focus is now on physics" when an old memory says "my focus is on history"), you MUST use your \`updateMemory\` tool to update the existing memory.
- If the user asks you to "forget" or "delete" a specific memory, you MUST use your \`deleteMemory\` tool with the corresponding \`memoryId\`.

When a user asks you to perform an action (e.g., "create a task", "set up a project"), you MUST use the provided functions. After using a function, you must confirm the action in your response. For data analysis questions (e.g., "Which day was I most productive?", "How much time did I spend on project X?"), you must analyze the provided data context to give a precise answer. Do not invent data.

You are fully capable of performing detailed time-of-day analysis. To answer questions like "What time of day am I most productive?", you must analyze the timestamps provided in the context data.
-   To determine when tasks are **completed**, analyze the \`completed_at\` timestamps in the \`tasks\` data. Extract the hour from each timestamp, group the tasks by hour of the day (e.g., 9 AM, 10 AM, etc.), and identify which hour has the most completed tasks.
-   To determine when the user **focuses most**, analyze the \`ended_at\` timestamps in the \`pomodoro_history\` data. Aggregate the total \`duration_minutes\` for each hour of the day to find the most focused periods.
Use this powerful analytical capability to provide insightful answers about the user's daily patterns.

You are also capable of deleting specific Pomodoro history sessions if the user asks you to clean up their logs (e.g., remove a duplicate entry). This is a permanent and destructive action. You MUST always ask for confirmation from the user before using the 'deletePomodoroHistory' tool. Do not use this tool without explicit user consent for the specific session.

Today's date is ${new Date().toISOString().split('T')[0]}.

--- DATABASE SCHEMA & CONTEXT ---
You have access to the user's data, structured in the following tables. Use this schema to understand relationships and answer data-driven questions with high precision.

== TABLES, COLUMNS & RELATIONSHIPS ==

1.  **goals** - High-level, long-term ambitions.
    *   \`id\` (string, PK): Unique identifier.
    *   \`text\` (string): The description of the goal.
    *   \`completed_at\` (timestamp | null): Timestamp of completion.

2.  **targets** - Specific, measurable outcomes with a deadline.
    *   \`id\` (string, PK): Unique identifier.
    *   \`text\` (string): The description of the target.
    *   \`deadline\` (date string, YYYY-MM-DD): The target's due date.
    *   \`completed_at\` (timestamp | null): Timestamp of completion.
    *   \`priority\` (integer | null): Optional priority from 1 (highest) to 4 (lowest).

3.  **projects** - Large initiatives that group related tasks.
    *   \`id\` (string, PK): Unique identifier.
    *   \`name\` (string): Project name.
    *   \`description\` (string | null): Detailed project description.
    *   \`start_date\` (date string | null): An optional date for when the project is planned to begin.
    *   \`deadline\` (date string | null): The project's due date.
    *   \`status\` (string): Current status: 'active', 'completed', or 'due'.
    *   \`completion_criteria_type\` (string): How completion is measured: 'manual', 'task_count', 'duration_minutes'.
    *   \`completion_criteria_value\` (number | null): The target value for the criteria (e.g., 10 for task_count).
    *   \`progress_value\` (number): Current progress towards the criteria value.
    *   \`priority\` (integer | null): Optional priority from 1 (highest) to 4 (lowest).
    *   \`active_days\` (array of integers | null): Days of week it is active (0=Sun, 6=Sat). Null/empty means active all days.

4.  **tasks** - Individual, actionable to-do items. The core unit of work.
    *   \`id\` (string, PK): Unique identifier.
    *   \`text\` (string): The task description.
    *   \`total_poms\` (number): Estimated Pomodoro sessions needed. A negative number (e.g., -1) indicates a "stopwatch" task where the timer counts up from zero instead of down.
    *   \`completed_poms\` (number): Pomodoro sessions completed for this task.
    *   \`comments\` (array of strings): **CRITICAL**: User's notes/comments added after each focus session. This contains valuable qualitative data on what was accomplished or learned.
    *   \`due_date\` (date string, YYYY-MM-DD): The task's due date.
    *   \`completed_at\` (timestamp | null): When the task was fully completed.
    *   \`project_id\` (string | null, FK -> projects.id): The project this task belongs to.
    *   \`tags\` (array of strings): User-defined tags for categorization.
    *   \`custom_focus_duration\` (number | null): Override for default focus time (in minutes).
    *   \`priority\` (integer | null): Optional priority from 1 (highest) to 4 (lowest).

5.  **pomodoro_history** - The authoritative log of all completed focus sessions.
    *   \`id\` (string, PK): Unique identifier.
    *   \`task_id\` (string | null, FK -> tasks.id): The task worked on during this session.
    *   \`ended_at\` (timestamp): Exact timestamp when the focus session ended.
    *   \`duration_minutes\` (number): The duration of the focus session.

6.  **commitments** - Promises or accountability items.
    *   \`id\` (string, PK): Unique identifier.
    *   \`text\` (string): The commitment text.
    *   \`due_date\` (date string | null): An optional due date.
    *   \`status\` (string): 'active', 'completed', or 'broken'.

7.  **ai_memories** - Your long-term memory about the user.
    *   \`id\` (string, PK): Unique identifier.
    *   \`type\` (string): 'learning' (from @learn), 'personal' (from @personal), or 'ai' (AI-inferred).
    *   \`content\` (string): The information to remember.
    *   \`tags\` (array of strings | null): Associated tags.
    *   \`source_task_id\` (string | null, FK -> tasks.id): The task that generated a 'learning' memory.

8.  **project_updates** - A manual log of updates for a project.
    *   \`id\` (string, PK): Unique identifier.
    *   \`project_id\` (string, FK -> projects.id)
    *   \`task_id\` (string | null, FK -> tasks.id)
    *   \`update_date\` (date string, YYYY-MM-DD)
    *   \`description\` (string): The text of the update.

9.  **daily_logs** (Provided in context as 'Daily Performance Logs') - A summary of daily activity derived from \`pomodoro_history\`.
    *   \`date\` (date string, YYYY-MM-DD)
    *   \`completed_sessions\` (number)
    *   \`total_focus_minutes\` (number)
    *   \`challenges\` (text): The user's daily reflection on problems faced.
    *   \`improvements\` (text): The user's daily reflection on how to improve.

--- CONTEXT DATA (${context.dateRangeDescription}) ---
The following is a snapshot of the user's data for the specified period.

== AI MEMORY BANK (Learnings & Personal Context) ==
${context.aiMemories.map(m => `- [${m.type.toUpperCase()}] (ID: ${m.id}) ${m.content} ${m.tags ? `Tags: [${m.tags.join(', ')}]` : ''}`).join('\n') || "No memories yet."}

== CORE GOALS ==
${context.goals.map(g => `- ${g.text} (ID: ${g.id})`).join('\n') || "No core goals set."}

== KEY TARGETS ==
${context.targets.map(t => `- [${t.completed_at ? 'X' : ' '}] ${t.text} (Due: ${t.deadline}, P:${t.priority || 3}, ID: ${t.id})`).join('\n') || 'No key targets set.'}

== PROJECTS ==
${context.projects.map(p => {
    let progress = '';
    if (p.completion_criteria_type === 'task_count') progress = `(${p.progress_value}/${p.completion_criteria_value} tasks)`;
    if (p.completion_criteria_type === 'duration_minutes') progress = `(${p.progress_value}/${p.completion_criteria_value} min)`;
    const activeDays = p.active_days && p.active_days.length > 0 ? p.active_days.join(',') : 'All';
    return `- ${p.name} [${p.status}] ${progress} (Starts: ${p.start_date || 'N/A'}, Due: ${p.deadline || 'N/A'}, P:${p.priority || 3}, Active Days: ${activeDays}, ID: ${p.id})`;
}).join('\n') || 'No projects.'}
Note: When adding a task to a project, you MUST use the project's ID.

== TASKS IN RANGE ==
${context.tasks.map(t => {
    const comments = t.comments && t.comments.length > 0 ? ` Comments: [${t.comments.join('; ')}]` : '';
    const tags = t.tags && t.tags.length > 0 ? ` Tags: [${t.tags.join(', ')}]` : '';
    return `- [${t.completed_at ? 'X' : ' '}] ${t.text} (${t.completed_poms}/${t.total_poms} poms, Due: ${t.due_date}, P:${t.priority || 3}, ProjectID: ${t.project_id || 'None'}, ID: ${t.id})${tags}${comments}`;
}).join('\n') || 'No tasks exist in this range.'}

== COMMITMENTS ==
${context.commitments.map(c => `- ${c.text} (Due: ${c.due_date || 'N/A'}, ID: ${c.id})`).join('\n') || 'No commitments made.'}

== DAILY PERFORMANCE LOGS & REFLECTIONS ==
This data is a summary derived from the \`pomodoro_history\` table and user reflections.
${context.dailyLogs.map(log => `- Date: ${log.date}, Focus Time: ${log.total_focus_minutes} minutes, Pomodoros: ${log.completed_sessions}
   ${log.challenges ? `* Challenges: ${log.challenges}` : ''}
   ${log.improvements ? `* Improvements: ${log.improvements}` : ''}`).join('\n') || 'No focus sessions recorded in this range.'}

== POMODORO HISTORY IN RANGE ==
This is the raw log of individual focus sessions. Use the \`ended_at\` timestamp for detailed time-of-day analysis.
${context.pomodoroHistory.map(p => `- Ended: ${p.ended_at}, Duration: ${p.duration_minutes} min, TaskID: ${p.task_id || 'None'}, ID: ${p.id}`).join('\n') || 'No individual focus sessions recorded in this range.'}
--- END OF CONTEXT ---

Based on this detailed data and schema, answer the user's questions and execute commands with precision.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: tools }],
        }
    });

    return response;
}