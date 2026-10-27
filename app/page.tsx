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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Признак выполнения добавления: блокирует кнопку и меняет её подпись.
  const [addingEmpty, setAddingEmpty] = useState(false);

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
    // Сразу показываем начало операции и очищаем предыдущую ошибку.
    setAddingEmpty(true);
    setError(null);

    // Отправляем через клиент Supabase запрос на создание строки в tasks.
    // «Пустая» запись содержит пустое название, отсутствие описания (null)
    // и начальный статус todo. Поля id и created_at не передаём:
    // для их автоматического заполнения в базе должны быть заданы значения по умолчанию.
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: "",
        description: null,
        status: "todo",
      })
      // Просим API вернуть созданную строку, включая заполненные базой поля.
      .select()
      // Ожидаем одну строку: data будет объектом задачи, а не массивом.
      // await приостанавливает эту функцию до получения ответа API.
      .single();

    // Ответ получен — возвращаем кнопке обычное состояние.
    setAddingEmpty(false);

    if (error) {
      // При ошибке показываем сообщение и не добавляем задачу в локальный список.
      // Ошибка может относиться как к вставке, так и к возврату строки через select.
      setError(error.message);
      return;
    }

    if (data) {
      // Приведение типа сообщает TypeScript ожидаемую структуру ответа;
      // оно не преобразует данные и не проверяет их во время выполнения.
      const newTask = data as Task;
      // Созданная строка уже пришла из базы. Теперь добавляем её в начало
      // актуального массива React, сохраняя остальные задачи через ...previousTasks.
      // setTasks вызывает повторный рендер, и запись появляется в таблице
      // без перезагрузки страницы и повторного запроса всего списка.
      setTasks((previousTasks) => [newTask, ...previousTasks]);
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
        Этап 4: просмотр, удаление и добавление пустой записи.
      </p>

      <div className="toolbar">
        {/* При клике запускаем addEmptyTask. Пока ожидаем ответ API,
            disabled защищает кнопку от повторного нажатия, а подпись
            «Добавление…» показывает, что операция выполняется. */}
        <button
          className="btn"
          onClick={addEmptyTask}
          disabled={addingEmpty}
        >
          {addingEmpty ? "Добавление…" : "Добавить пустую запись"}
        </button>
      </div>

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
