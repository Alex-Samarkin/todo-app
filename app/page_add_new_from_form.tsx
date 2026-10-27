"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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

const statusOptions: Task["status"][] = [
  "todo",
  "in progress",
  "done",
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [addingEmpty, setAddingEmpty] = useState(false);
  const [addingFilled, setAddingFilled] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<Task["status"]>("todo");

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

  async function addEmptyTask() {
    setAddingEmpty(true);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: "",
        description: null,
        status: "todo",
      })
      .select()
      .single();

    setAddingEmpty(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data) {
      const newTask = data as Task;
      setTasks((previousTasks) => [newTask, ...previousTasks]);
    }
  }

  async function addFilledTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = formTitle.trim();

    if (!title) {
      return;
    }

    const description =
      formDescription.trim() === "" ? null : formDescription.trim();

    setAddingFilled(true);
    setError(null);

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        status: formStatus,
      })
      .select()
      .single();

    setAddingFilled(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data) {
      const newTask = data as Task;
      setTasks((previousTasks) => [newTask, ...previousTasks]);

      setFormTitle("");
      setFormDescription("");
      setFormStatus("todo");
    }
  }

  async function deleteTask(id: number) {
    const confirmed = window.confirm("Удалить эту запись?");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError(null);

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    setDeletingId(null);

    if (error) {
      setError(error.message);
      return;
    }

    setTasks((previousTasks) =>
      previousTasks.filter((task) => task.id !== id)
    );
  }

  return (
    <main>
      <h1>Список дел</h1>
      <p className="muted">
        Этап 5: просмотр, удаление, добавление пустой и заполненной записи.
      </p>

      <div className="toolbar">
        <button
          className="btn"
          onClick={addEmptyTask}
          disabled={addingEmpty}
        >
          {addingEmpty ? "Добавление…" : "Добавить пустую запись"}
        </button>
      </div>

      <form className="form" onSubmit={addFilledTask}>
        <h2>Добавить заполненную запись</h2>

        <label>
          <span>Задача</span>
          <input
            value={formTitle}
            onChange={(event) => setFormTitle(event.target.value)}
            placeholder="Например: подготовить лекцию"
            required
          />
        </label>

        <label>
          <span>Описание</span>
          <textarea
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
            placeholder="Необязательно"
          />
        </label>

        <label>
          <span>Статус</span>
          <select
            value={formStatus}
            onChange={(event) =>
              setFormStatus(event.target.value as Task["status"])
            }
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusNames[status]}
              </option>
            ))}
          </select>
        </label>

        <div className="form-actions">
          <button
            type="submit"
            className="btn primary"
            disabled={addingFilled}
          >
            {addingFilled ? "Сохранение…" : "Добавить заполненную запись"}
          </button>
        </div>
      </form>

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
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  {task.title || <span className="muted">Без названия</span>}
                </td>
                <td>
                  {task.description || <span className="muted">—</span>}
                </td>
                <td>
                  {new Date(task.created_at).toLocaleString("ru-RU")}
                </td>
                <td>
                  {statusNames[task.status] ?? task.status}
                </td>
                <td>
                  <button
                    className="btn danger"
                    onClick={() => deleteTask(task.id)}
                    disabled={deletingId === task.id}
                  >
                    {deletingId === task.id ? "Удаление…" : "Удалить"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}