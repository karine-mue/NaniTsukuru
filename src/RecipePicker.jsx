import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";

export default function RecipePicker({ allRecipes, onSelect, onClose, onAddNew }) {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");

  const tags = useMemo(() => {
    return ["all", ...Array.from(new Set(allRecipes.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, "ja"))];
  }, [allRecipes]);

  const filtered = allRecipes.filter((r) => {
    if (tagFilter !== "all" && !r.tags.includes(tagFilter)) return false;
    if (search && !r.name.includes(search) && !(r.description || "").includes(search) && !r.tags.some((t) => t.includes(search))) return false;
    return true;
  });

  return (
    <div className="popoverOverlay" onClick={onClose}>
      <div className="pickerModal" onClick={(e) => e.stopPropagation()}>
        <div className="popoverHeader">
          <h3>レシピを選択</h3>
          <button className="closeBtn" onClick={onClose}>✕</button>
        </div>
        <div className="pickerFilters">
          <input
            type="search"
            placeholder="レシピ名で検索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag === "all" ? "すべて" : tag}</option>
            ))}
          </select>
        </div>
        <div className="pickerList">
          {filtered.length === 0 && <p className="empty">レシピが見つかりません</p>}
          {filtered.map((recipe) => (
            <button key={recipe.id} className="pickerItem" onClick={() => onSelect(recipe.id)}>
              <div className="pickerItemName">
                {recipe.name}
                {recipe.id.startsWith("custom-") && <span className="customBadge">追加</span>}
              </div>
              <div className="pickerItemDesc">{recipe.description}</div>
              <div className="pickerItemMeta">
                <div className="tags">
                  {recipe.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <span>{recipe.servings}人分 / 約{recipe.cost.toLocaleString()}円</span>
              </div>
            </button>
          ))}
        </div>
        <div className="pickerFooter">
          <button className="secondary" onClick={onAddNew}>
            <Plus size={15} />新しいレシピを追加
          </button>
        </div>
      </div>
    </div>
  );
}
