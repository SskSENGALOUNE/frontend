"use client";

import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { Category, TxnType } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { CategoryEditor } from "@/components/category-editor";
import { CategoryIcon } from "@/components/category-icon";
import { Sheet } from "@/components/sheet";
import { ErrorState, ListSkeleton, PageHeader, Row, TypeToggle } from "@/components/ui";

export default function CategoriesPage() {
  const cats = useData<Category[]>("/categories");
  const [type, setType] = useState<TxnType>("expense");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const list = (cats.data ?? []).filter((c) => c.type === type);

  return (
    <>
      <PageHeader title="ໝວດ">
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus className="size-5" aria-hidden />
          ເພີ່ມໝວດ
        </button>
      </PageHeader>
      <TypeToggle value={type} onChange={setType} />

      {cats.error && !cats.data ? (
        <ErrorState message={cats.error} onRetry={cats.reload} />
      ) : !cats.data ? (
        <div className="card">
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <ul className="card p-2" data-testid="category-list">
          {list.map((c) => (
            <li key={c.id}>
              <Row onClick={() => setEditing(c)} leading={<CategoryIcon icon={c.icon} color={c.color} name={c.name} />} title={c.name} trailing={<ChevronRight className="size-5 text-muted" aria-hidden />} />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "ເພີ່ມໝວດ" : "ແກ້ໄຂໝວດ"}>
        {editing && (
          <CategoryEditor
            category={editing === "new" ? null : editing}
            defaultType={type}
            onDone={() => {
              setEditing(null);
              cats.reload();
            }}
          />
        )}
      </Sheet>
    </>
  );
}
