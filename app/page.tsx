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

type TaskStatus = Task["status"];

const statusNames: Record<TaskStatus, string> = {
  "todo": "К выполнению",
  "in progress": "В работе",
  "done": "Готово",
};

const statusOptions: TaskStatus[] = [
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
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");

  // ID строки, открытой для редактирования. null — все строки в режиме просмотра.
  // Один ID и один набор полей ниже позволяют редактировать одну задачу за раз.
  const [editingId, setEditingId] = useState<number | null>(null);
  // Черновик: ввод пользователя хранится отдельно от сохранённых задач в tasks.
  // Пока не нажато «Сохранить», изменения этих полей не отправляются в базу.
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("todo");
  // Показывает ожидание ответа на запрос сохранения и блокирует кнопки строки.
  const [savingEdit, setSavingEdit] = useState(false);

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

  function startEditing(task: Task) {
    // Кнопка «Редактировать» передаёт сюда задачу из текущего массива tasks.
    // Запоминаем её ID и копируем сохранённые значения в отдельный черновик.
    // Изменение editingId переключит JSX этой строки с текста на поля ввода.
    setEditingId(task.id);
    setEditTitle(task.title);
    // textarea работает со строкой, поэтому отсутствие описания (null)
    // представляем в поле как пустую строку.
    setEditDescription(task.description ?? "");
    setEditStatus(task.status);
  }

  function cancelEditing() {
    // Закрываем режим редактирования и очищаем черновик.
    // Запроса к базе нет, tasks не меняется: несохранённый ввод отбрасывается.
    // Эта же функция вызывается после успешного сохранения для закрытия полей.
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditStatus("todo");
  }

  async function saveEditing() {
    // Защита на случай вызова, когда ни одна задача не редактируется.
    if (editingId === null) {
      return;
    }

    // Удаляем пробелы по краям. Пустое или состоящее из пробелов название
    // не сохраняем: проверка дублирует условие блокировки кнопки в интерфейсе.
    const title = editTitle.trim();

    if (!title) {
      return;
    }

    // Для базы пустое описание представляем как null, а заполненное —
    // как строку без пробелов по краям. Сам черновик при этом не изменяется.
    const description =
      editDescription.trim() === "" ? null : editDescription.trim();

    // Включаем индикацию сохранения и убираем предыдущее сообщение об ошибке.
    setSavingEdit(true);
    setError(null);

    // Путь данных: поля черновика → API Supabase → обновлённая строка в базе
    // → ответ data → замена задачи в tasks → повторный рендер таблицы.
    // update передаёт только изменяемые поля; id и created_at здесь не задаются.
    // Доступ к обновлению и чтению результата определяется правами базы и RLS.
    const { data, error } = await supabase
      .from("tasks")
      .update({
        title,
        description,
        status: editStatus,
      })
      // Ограничиваем обновление задачей с выбранным ID.
      .eq("id", editingId)
      // Запрашиваем фактическую строку после обновления, чтобы использовать
      // ответ базы, а не самостоятельно собранный объект из полей черновика.
      .select()
      // Ожидаем ровно одну строку в виде объекта. Если строка не вернулась,
      // single сообщит об ошибке. await ждёт завершения запроса к API.
      .single();

    // Ответ получен — снимаем признак выполняющегося сохранения.
    setSavingEdit(false);

    if (error) {
      // При ошибке не меняем tasks и не очищаем черновик.
      // Ошибка может относиться к обновлению либо к чтению результата.
      // В текущем JSX условие !error скрывает таблицу при наличии ошибки.
      setError(error.message);
      return;
    }

    if (data) {
      // Приведение типа помогает TypeScript; проверки данных во время
      // выполнения оно не делает.
      const updatedTask = data as Task;

      // Функциональная форма получает актуальный массив задач.
      // map создаёт новый массив: задачу с совпадающим ID заменяем ответом
      // базы, остальные оставляем прежними. Повторной загрузки списка нет.
      // До этого момента сохранённая задача в локальном tasks не менялась.
      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task
        )
      );

      // После обновления списка закрываем редактор и сбрасываем черновик.
      cancelEditing();
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
        Этап 6: просмотр, удаление, добавление и редактирование задач.
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
              setFormStatus(event.target.value as TaskStatus)
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
                {/* Для выбранной задачи показываем поля черновика,
                    для остальных — сохранённые значения из tasks. */}
                {editingId === task.id ? (
                  <>
                    <td>
                      {/* Управляемое поле: value берётся из состояния React,
                          onChange записывает каждый ввод в editTitle.
                          Аналогично работают описание и выбор статуса ниже.
                          Эти обработчики не отправляют запросов в базу. */}
                      <input
                        className="table-input"
                        value={editTitle}
                        onChange={(event) =>
                          setEditTitle(event.target.value)
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        className="table-input"
                        value={editDescription}
                        onChange={(event) =>
                          setEditDescription(event.target.value)
                        }
                      />
                    </td>
                    <td>
                      {/* Дата создания остаётся только для просмотра. */}
                      {new Date(task.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td>
                      <select
                        className="table-input"
                        value={editStatus}
                        onChange={(event) =>
                          setEditStatus(event.target.value as TaskStatus)
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusNames[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="row-actions">
                        {/* Сохранение запускается по клику. Во время запроса
                            и при пустом названии кнопка недоступна. */}
                        <button
                          className="btn primary"
                          onClick={saveEditing}
                          disabled={
                            savingEdit || editTitle.trim() === ""
                          }
                        >
                          {savingEdit ? "Сохранение…" : "Сохранить"}
                        </button>
                        {/* Отмена отбрасывает черновик. Во время сохранения
                            она отключена, чтобы не закрыть редактор до ответа. */}
                        <button
                          className="btn"
                          onClick={cancelEditing}
                          disabled={savingEdit}
                        >
                          Отмена
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      {task.title || (
                        <span className="muted">Без названия</span>
                      )}
                    </td>
                    <td>
                      {task.description || <span className="muted">—</span>}
                    </td>
                    <td>
                      {new Date(task.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td>{statusNames[task.status]}</td>
                    <td>
                      <div className="row-actions">
                        {/* Передаём задачу в startEditing только по клику.
                            Пока открыта одна строка, начать редактирование
                            другой нельзя — иначе общий черновик заменился бы. */}
                        <button
                          className="btn primary"
                          onClick={() => startEditing(task)}
                          disabled={editingId !== null}
                        >
                          Редактировать
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => deleteTask(task.id)}
                          disabled={
                            deletingId === task.id ||
                            editingId === task.id
                          }
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
