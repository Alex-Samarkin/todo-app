// Клиентский компонент: использует состояние React, эффекты и window.confirm.
// Запросы к Supabase ниже выполняются из браузера пользователя.
"use client";

import { useEffect, useState } from "react";
// Готовый клиент создаётся в lib/supabase.ts из NEXT_PUBLIC_SUPABASE_URL
// и NEXT_PUBLIC_SUPABASE_KEY. Через него браузер обращается к API Supabase.
import { supabase } from "../lib/supabase";

// Ожидаемая структура одной строки таблицы tasks.
// Тип помогает TypeScript проверять код, но сам по себе не проверяет ответ API.
type Task = {
  id: number;
  title: string;
  description: string | null;
  created_at: string; // Дата приходит из API строкой; преобразуем её при выводе.
  status: "todo" | "in progress" | "done";
};

// В базе хранятся значения статусов на английском, а здесь — подписи для экрана.
const statusNames: Record<string, string> = {
  "todo": "К выполнению",
  "in progress": "В работе",
  "done": "Готово",
};

export default function Home() {
  // Локальная копия полученных задач. Изменение состояния через setTasks
  // вызывает повторный рендер: React строит таблицу по обновлённому массиву.
  const [tasks, setTasks] = useState<Task[]>([]);
  // Пока запрос чтения выполняется, показываем индикатор загрузки.
  const [loading, setLoading] = useState(true);
  // Общее сообщение об ошибке чтения или удаления.
  const [error, setError] = useState<string | null>(null);
  // ID удаляемой задачи нужен для блокировки её кнопки и подписи «Удаление…».
  // null означает, что сейчас ни одна задача не отмечена как удаляемая.
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Путь данных: таблица tasks в Supabase → ответ API → setTasks → таблица в JSX.
  async function loadTasks() {
    // Перед запросом включаем загрузку и очищаем предыдущее сообщение об ошибке.
    setLoading(true);
    setError(null);

    // from выбирает таблицу, select("*") запрашивает все столбцы,
    // order сортирует записи на стороне базы: сначала самые новые.
    // await ждёт ответ API; доступные строки определяются правами и RLS в базе.
    // Здесь error — ошибка этого запроса, а не состояние error из useState выше.
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // При ошибке сохраняем сообщение для вывода в интерфейсе.
      setError(error.message);
    } else {
      // Ответ data содержит массив строк. Если data отсутствует, берём [].
      // Сохранение в состояние запускает рендер с полученными задачами.
      setTasks(data ?? []);
    }

    // Ответ обработан: скрываем индикатор и показываем результат или ошибку.
    setLoading(false);
  }

  useEffect(() => {
    // После монтирования компонента запускаем загрузку.
    // Пустой массив зависимостей не даёт повторять её при каждом рендере.
    // В режиме разработки Strict Mode может повторно запускать эффект.
    // Подписки на изменения базы здесь нет: список сам по себе не обновляется.
    loadTasks();
  }, []);

  async function deleteTask(id: number) {
    // ID передаётся из кнопки конкретной строки. При отмене диалога
    // выходим до отправки запроса и до изменения состояния страницы.
    const confirmed = window.confirm("Удалить эту запись?");
    if (!confirmed) {
      return;
    }

    // Отмечаем задачу как удаляемую и сбрасываем старую ошибку.
    setDeletingId(id);
    setError(null);

    // Удаление в базе: delete() задаёт операцию, eq("id", id) ограничивает
    // её строками с указанным ID. Этот фильтр определяет, что именно удалять.
    // Запрос идёт через API Supabase; разрешение удаления проверяет база.
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    // Ответ получен — снимаем признак выполнения запроса.
    setDeletingId(null);

    if (error) {
      // При ошибке локальный массив не меняем. Сообщение показывается выше
      // таблицы; из-за условия !error сама таблица в этот момент скрывается.
      setError(error.message);
      return;
    }

    // Если API не вернул ошибку, убираем задачу и из локального состояния.
    // filter создаёт новый массив без указанного ID, не меняя прежний массив.
    // Функциональная форма setTasks получает актуальное состояние React.
    // Это обновление экрана, а удаление в базе запрашивалось выше;
    // повторного чтения всех задач после удаления здесь нет.
    // Важно: отсутствие ошибки не подтверждает число удалённых строк.
    // Например, если права/RLS не позволили затронуть строку, запрос может
    // завершиться без ошибки и без удаления; этот код число строк не проверяет.
    setTasks((previousTasks) =>
      previousTasks.filter((task) => task.id !== id)
    );
  }

  return (
    <main>
      <h1>Список дел</h1>
      <p className="muted">
        Этап 3: просмотр и удаление задач.
      </p>

      {/* Состояния страницы: загрузка, ошибка, пустой список или таблица. */}
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
            {/* Каждая задача из состояния становится строкой таблицы.
                Стабильный key по ID помогает React сопоставлять строки
                после изменения списка, в том числе после удаления. */}
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  {task.title || <span className="muted">Без названия</span>}
                </td>
                <td>
                  {task.description || <span className="muted">—</span>}
                </td>
                <td>
                  {/* Преобразуем строку даты в Date и форматируем по-русски.
                      Часовой пояс берётся из настроек браузера. */}
                  {new Date(task.created_at).toLocaleString("ru-RU")}
                </td>
                <td>
                  {/* Если подпись для статуса не найдена, выводим само значение. */}
                  {statusNames[task.status] ?? task.status}
                </td>
                <td>
                  {/* Обёртка вызывает deleteTask только при клике и передаёт ID
                      этой задачи. Пока её запрос выполняется, кнопка отключена. */}
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
