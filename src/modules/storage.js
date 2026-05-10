// Storage Module
import { state, normalizeTaskRecurrence, normalizeTaskSubtasks } from './state.js';

const API_BASE = '/api';

// Вспомогательная функция для API-запросов
async function apiRequest(method, key, body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${API_BASE}/storage?key=${encodeURIComponent(key)}`, options);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        if (method === 'GET') {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error(`API request failed for ${key}:`, error);
        // Fallback: пробуем localStorage, если сервер недоступен
        if (method === 'GET') {
            const localData = localStorage.getItem(key);
            return localData ? JSON.parse(localData) : null;
        }
        // Если сохранение не удалось — тихо игнорируем, данные не потеряны в state
        return null;
    }
}

export async function loadData() {
    try {
        // Пытаемся загрузить с сервера
        const serverData = await apiRequest('GET', 'kanban-tasks');

        if (serverData) {
            // Применяем миграцию полей (оставляю вашу логику)
            state.tasks = serverData.map(task => ({
                ...task,
                totalTime: task.totalTime || 0,
                isTracking: task.isTracking || false,
                lastStartTime: task.lastStartTime || null,
                timeLogs: task.timeLogs || [],
                memoSessions: task.memoSessions || [],
                activeMemoSession: task.activeMemoSession || null,
                priority: task.priority || 'medium',
                dueDate: task.dueDate || null,
                tags: task.tags || [],
                url: task.url || '',
                subtasks: normalizeTaskSubtasks(task.subtasks),
                ...normalizeTaskRecurrence(task)
            }));
        } else {
            // Если сервер не вернул данные — пробуем localStorage
            const loadedTasks = localStorage.getItem('kanban-tasks');
            state.tasks = loadedTasks ? JSON.parse(loadedTasks) : [];
            // Миграция
            state.tasks = state.tasks.map(task => ({
                ...task,
                totalTime: task.totalTime || 0,
                isTracking: task.isTracking || false,
                lastStartTime: task.lastStartTime || null,
                timeLogs: task.timeLogs || [],
                memoSessions: task.memoSessions || [],
                activeMemoSession: task.activeMemoSession || null,
                priority: task.priority || 'medium',
                dueDate: task.dueDate || null,
                tags: task.tags || [],
                url: task.url || '',
                subtasks: normalizeTaskSubtasks(task.subtasks),
                ...normalizeTaskRecurrence(task)
            }));
        }

        const activeMemoTask = state.tasks.find(task => task.isTracking && task.activeMemoSession);
        state.activeMemoDraftTaskId = activeMemoTask ? activeMemoTask.id : null;
    } catch (e) {
        console.error('Failed to load tasks:', e);
        state.tasks = [];
    }

    try {
        const serverHistory = await apiRequest('GET', 'kanban-history');
        if (serverHistory) {
            state.history = serverHistory;
        } else {
            const loadedHistory = localStorage.getItem('kanban-history');
            state.history = loadedHistory ? JSON.parse(loadedHistory) : [];
        }
    } catch (e) {
        console.error('Failed to load history:', e);
        state.history = [];
    }
}

export async function saveData() {
    // Сохраняем и на сервер, и в localStorage (для оффлайн-режима)
    localStorage.setItem('kanban-tasks', JSON.stringify(state.tasks));
    await apiRequest('POST', 'kanban-tasks', state.tasks);
}

export async function saveHistory() {
    localStorage.setItem('kanban-history', JSON.stringify(state.history));
    await apiRequest('POST', 'kanban-history', state.history);
}

// Экспорт и импорт оставляю без изменений — они работают локально
export function exportBoardData() {
    const data = {
        tasks: state.tasks,
        history: state.history,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function importBoardData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.tasks && Array.isArray(data.tasks)) {
            state.tasks = data.tasks.map(task => ({
                ...task,
                memoSessions: task.memoSessions || [],
                activeMemoSession: task.activeMemoSession || null,
                subtasks: normalizeTaskSubtasks(task.subtasks),
                ...normalizeTaskRecurrence(task)
            }));
            saveData();
        }
        if (data.history && Array.isArray(data.history)) {
            state.history = data.history;
            saveHistory();
        }
        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}
