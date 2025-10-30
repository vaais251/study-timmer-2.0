// Fix: Add Deno types reference to resolve "Cannot find name 'Deno'" errors.
// FIX: Updated the Deno types reference to a valid URL to resolve 'Cannot find name Deno' errors.
/// <reference types="https://raw.githubusercontent.com/denoland/deno/v1.44.4/runtime/dts/lib.deno.d.ts" />

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Helper function to get the date string for N days ago
const getDaysAgoDateString = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
};

// Helper to format minutes into a readable string (e.g., "2h 30m")
const formatMinutes = (minutes: number): string => {
    if (minutes < 1) return "0m";
    const hours = Math.floor(minutes / 60);
    const remainingMins = Math.round(minutes % 60);
    if (hours > 0 && remainingMins > 0) return `${hours}h ${remainingMins}m`;
    if (hours > 0) return `${hours}h`;
    return `${remainingMins}m`;
};

Deno.serve(async (_req) => {
    try {
        // --- 1. Initialize Clients ---
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) throw new Error('RESEND_API_KEY is not set.');
        const resend = new Resend(resendApiKey);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error('Supabase credentials are not set.');
        
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

        // --- 2. Define Date Range for the Past Week ---
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = getDaysAgoDateString(6);

        // --- 3. Fetch User and Data from Supabase ---
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        if (usersError || !users || users.length === 0) {
            throw new Error('Could not fetch users or no users found.');
        }
        // This report will be sent to the first user found in your project.
        const user = users[0];
        if (!user.email) {
             throw new Error(`User with ID ${user.id} does not have an email.`);
        }

        const [
            dailyLogsRes,
            tasksRes,
            projectsRes,
            pomodoroHistoryRes
        ] = await Promise.all([
            supabaseAdmin.from('daily_logs').select('total_focus_minutes, date').eq('user_id', user.id).gte('date', startDate).lte('date', endDate),
            supabaseAdmin.from('tasks').select('text, completed_at, id, tags').eq('user_id', user.id).gte('due_date', startDate).lte('due_date', endDate),
            supabaseAdmin.from('projects').select('name').eq('user_id', user.id).gte('completed_at', `${startDate}T00:00:00Z`).lte('completed_at', `${endDate}T23:59:59Z`),
            supabaseAdmin.from('pomodoro_history').select('duration_minutes, task_id').eq('user_id', user.id).gte('ended_at', `${startDate}T00:00:00Z`).lte('ended_at', `${endDate}T23:59:59Z`)
        ]);

        if (dailyLogsRes.error) throw new Error(`Daily logs fetch error: ${dailyLogsRes.error.message}`);
        if (tasksRes.error) throw new Error(`Tasks fetch error: ${tasksRes.error.message}`);
        if (projectsRes.error) throw new Error(`Projects fetch error: ${projectsRes.error.message}`);
        if (pomodoroHistoryRes.error) throw new Error(`Pomodoro history fetch error: ${pomodoroHistoryRes.error.message}`);

        const dailyLogs = dailyLogsRes.data || [];
        const tasks = tasksRes.data || [];
        const completedProjects = projectsRes.data || [];
        const pomodoroHistory = pomodoroHistoryRes.data || [];

        // --- 4. Calculate Statistics ---
        const totalFocusMinutes = dailyLogs.reduce((sum, log) => sum + log.total_focus_minutes, 0);
        
        const completedTasksCount = tasks.filter(t => t.completed_at).length;
        const totalTasksCount = tasks.length;
        const taskCompletionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
        
        const incompleteTasks = tasks.filter(t => !t.completed_at).map(t => t.text);
        
        let mostProductiveDay = { date: 'N/A', minutes: 0 };
        if (dailyLogs.length > 0) {
            mostProductiveDay = dailyLogs.reduce((max, log) => log.total_focus_minutes > max.minutes ? { date: log.date, minutes: log.total_focus_minutes } : max, { date: dailyLogs[0].date, minutes: dailyLogs[0].total_focus_minutes });
            const dayOfWeek = new Date(mostProductiveDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
            mostProductiveDay.date = dayOfWeek;
        }

        const taskMap = new Map<string, { tags: string[] }>();
        tasks.forEach(task => taskMap.set(task.id, { tags: task.tags || [] }));
        
        const focusByTag = new Map<string, number>();
        pomodoroHistory.forEach(h => {
            const task = h.task_id ? taskMap.get(h.task_id) : null;
            if (task && task.tags.length > 0) {
                task.tags.forEach(tag => {
                    const normalizedTag = tag.trim().toLowerCase();
                    focusByTag.set(normalizedTag, (focusByTag.get(normalizedTag) || 0) + (Number(h.duration_minutes) || 0));
                });
            }
        });

        const topTags = Array.from(focusByTag.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, minutes]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), time: formatMinutes(minutes) }));

        // --- 5. Construct Email HTML ---
        const htmlBody = `
            <div style="font-family: 'Inter', sans-serif; background-color: #111827; color: #e5e7eb; padding: 40px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 28px;">Your Weekly FocusFlow Summary</h1>
                <p style="color: #9ca3af; font-size: 16px;">Here's how you did from ${startDate} to ${endDate}. Keep up the great work!</p>
                
                <div style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px; margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: center;">
                    <div>
                        <p style="font-size: 12px; color: #9ca3af; margin: 0; text-transform: uppercase;">Total Focus Time</p>
                        <p style="font-size: 36px; color: #34d399; margin: 5px 0 0 0; font-weight: bold;">${formatMinutes(totalFocusMinutes)}</p>
                    </div>
                     <div>
                        <p style="font-size: 12px; color: #9ca3af; margin: 0; text-transform: uppercase;">Task Completion</p>
                        <p style="font-size: 36px; color: #60a5fa; margin: 5px 0 0 0; font-weight: bold;">${taskCompletionRate}%</p>
                        <p style="font-size: 12px; color: #9ca3af; margin-top: 5px;">${completedTasksCount} of ${totalTasksCount} tasks</p>
                    </div>
                </div>

                <div style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left;">
                    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Weekly Highlights</h2>
                    <ul style="list-style-type: none; padding: 0;">
                        <li style="margin-bottom: 12px;">🏆 <strong>Most Productive Day:</strong> ${mostProductiveDay.date} with ${formatMinutes(mostProductiveDay.minutes)} of focus.</li>
                        ${completedProjects.length > 0 ? `<li style="margin-bottom: 12px;">🚀 <strong>Projects Completed:</strong> ${completedProjects.map(p => p.name).join(', ')}</li>` : ''}
                    </ul>
                </div>
                
                ${topTags.length > 0 ? `
                <div style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left;">
                    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Top Focus Areas</h2>
                     <ul style="list-style-type: none; padding: 0;">
                        ${topTags.map(tag => `<li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #374151;"><span>${tag.name}</span> <span style="font-weight: bold; color: #f59e0b;">${tag.time}</span></li>`).join('')}
                    </ul>
                </div>` : ''}

                ${incompleteTasks.length > 0 ? `
                <div style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 24px; margin-top: 20px; text-align: left;">
                    <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Let's Tackle These Next!</h2>
                    <ul style="list-style-type: '☑️ '; padding-left: 20px; color: #9ca3af;">
                        ${incompleteTasks.map(task => `<li style="margin-bottom: 8px;">${task}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>
        `;
        
        // --- 6. Send Email ---
        const { error: emailError } = await resend.emails.send({
            from: 'FocusFlow Progress <onboarding@resend.dev>', // Replace with your verified domain if you have one
            to: [user.email],
            subject: `🚀 Your Weekly FocusFlow Progress Report!`,
            html: htmlBody,
        });

        if (emailError) throw new Error(`Email sending error: ${emailError.message}`);

        // --- 7. Return Success Response ---
        return new Response(JSON.stringify({ message: `Weekly report sent to ${user.email}` }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Function error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});