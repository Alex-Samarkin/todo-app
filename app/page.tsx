"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Task = {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  status: "todo" | "in progress" | "done";
};

const statusNames: Record<string, string> = {
  "todo": "К выполнению",
  "in progress": "В работе",
  "done": "Готово",
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <main>
      <h1>Список дел</h1>
      <p className="muted">Этап 2: просмотр задач. Изменение — в следующих этапах.</p>

      {loading && <p>Загрузка…</p>}
      {error && <p className="error">Ошибка: {error}</p>}
      {!loading && !error && tasks.length === 0 && (
        <p>Записей пока нет.</p>
      )}

      {!loading && !error && tasks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Задача</th>
              <th>Описание</th>
              <th>Дата создания</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title || <span className="muted">Без названия</span>}</td>
                <td>{task.description || <span className="muted">—</span>}</td>
                <td>{new Date(task.created_at).toLocaleString("ru-RU")}</td>
                <td>{statusNames[task.status] ?? task.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}