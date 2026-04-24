import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Info, Plus, Printer, ShoppingCart, Flame, Share2, RotateCcw, X } from "lucide-react";
import recipes from "./recipes.json";
import "./styles.css";

const MAX_PER_SLOT = 4;

const categoryOrder = [
  "肉・魚", "野菜", "乳製品", "主食", "缶詰・乾物", "調味料", "消耗品", "その他"
];

function generateMealSlots(nights) {
  const days = nights + 1;
  const slots = [{ id: "d1-dinner", label: "1日目 夜", hint: "到着後。主役料理向き" }];
  for (let d = 2; d < days; d++) {
    slots.push({ id: `d${d}-breakfast`, label: `${d}日目 朝`, hint: "温かい・簡単重視" });
    slots.push({ id: `d${d}-lunch`,     label: `${d}日目 昼`, hint: "軽め/残り物でも可" });
    slots.push({ id: `d${d}-dinner`,    label: `${d}日目 夜`, hint: "煮込み・肉料理向き" });
  }
  slots.push({ id: `d${days}-breakfast`, label: `${days}日目 朝`, hint: "撤収前。片付け軽め" });
  return slots;
}

function initPlan(slots) {
  return Object.fromEntries(slots.map((slot) => [slot.id, [""]]));
}

function parsePlanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const nights = Number(params.get("nights") || 2);
  const validNights = [1, 2, 3, 4].includes(nights) ? nights : 2;
  const people = Number(params.get("people") || 2);
  const slots = generateMealSlots(validNights);
  const plan = {};
  for (const slot of slots) {
    const items = [];
    for (let i = 0; i < MAX_PER_SLOT; i++) {
      const val = params.get(`${slot.id}-${i}`);
      if (val !== null) items.push(val);
    }
    plan[slot.id] = items.length > 0 ? items : [""];
  }
  return { plan, people: Number.isFinite(people) && people > 0 ? people : 2, nights: validNights };
}

function formatAmount(n) {
  if (typeof n !== "number") return n;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function scaleAmount(amount, recipeServings, people) {
  if (typeof amount !== "number") return amount;
  return amount * (people / recipeServings);
}

function buildShoppingList(selectedRecipes, people) {
  const map = new Map();
  for (const recipe of selectedRecipes) {
    for (const ing of recipe.ingredients) {
      const key = `${ing.itemId}__${ing.unit}`;
      const scaled = scaleAmount(ing.amount, recipe.servings, people);
      if (!map.has(key)) {
        map.set(key, {
          itemId: ing.itemId,
          name: ing.name,
          category: ing.category || "その他",
          unit: ing.unit,
          amount: typeof scaled === "number" ? 0 : [],
          usedIn: []
        });
      }
      const item = map.get(key);
      if (typeof scaled === "number") item.amount += scaled;
      else item.amount.push(scaled);
      item.usedIn.push(recipe.name);
    }
  }
  const rows = Array.from(map.values()).map((item) => ({
    ...item,
    amountLabel: typeof item.amount === "number"
      ? `${formatAmount(item.amount)} ${item.unit}`
      : Array.from(new Set(item.amount)).join(" / ")
  }));
  rows.sort((a, b) => {
    const oa = categoryOrder.indexOf(a.category);
    const ob = categoryOrder.indexOf(b.category);
    if ((oa === -1 ? 999 : oa) !== (ob === -1 ? 999 : ob)) return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
    return a.name.localeCompare(b.name, "ja");
  });
  return rows;
}

function groupByCategory(items) {
  return items.reduce((acc, item) => {
    const key = item.category || "その他";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function App() {
  const parsed = parsePlanFromUrl();
  const [people, setPeople] = useState(parsed.people);
  const [nights, setNights] = useState(parsed.nights);
  const [plan, setPlan] = useState(parsed.plan);
  const [tagFilter, setTagFilter] = useState("all");
  const [activePopover, setActivePopover] = useState(null);

  const mealSlots = useMemo(() => generateMealSlots(nights), [nights]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setActivePopover(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tags = useMemo(() => {
    return ["all", ...Array.from(new Set(recipes.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, "ja"))];
  }, []);

  const allSelectedRecipes = useMemo(() => {
    const result = [];
    for (const slot of mealSlots) {
      for (const id of (plan[slot.id] || [])) {
        if (id) {
          const recipe = recipes.find((r) => r.id === id);
          if (recipe) result.push(recipe);
        }
      }
    }
    return result;
  }, [plan, mealSlots]);

  const uniqueSelectedRecipes = useMemo(() => {
    const seen = new Set();
    return allSelectedRecipes.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [allSelectedRecipes]);

  const totalCost = useMemo(() => {
    return allSelectedRecipes.reduce((sum, r) => sum + Math.round(r.cost * (people / r.servings)), 0);
  }, [allSelectedRecipes, people]);

  const shoppingList = useMemo(() => buildShoppingList(allSelectedRecipes, people), [allSelectedRecipes, people]);
  const grouped = groupByCategory(shoppingList);

  const filteredRecipes = recipes.filter((r) => tagFilter === "all" || r.tags.includes(tagFilter));

  const popoverRecipe = activePopover
    ? recipes.find((r) => r.id === plan[activePopover.slotId]?.[activePopover.index])
    : null;

  function handleNightsChange(newNights) {
    const newSlots = generateMealSlots(newNights);
    setPlan((prev) => {
      const next = {};
      for (const slot of newSlots) {
        next[slot.id] = prev[slot.id] ?? [""];
      }
      return next;
    });
    setNights(newNights);
  }

  function updateSlotItem(slotId, index, recipeId) {
    setPlan((prev) => {
      const items = [...(prev[slotId] || [""])];
      items[index] = recipeId;
      return { ...prev, [slotId]: items };
    });
    setActivePopover(null);
  }

  function addSlotItem(slotId) {
    setPlan((prev) => {
      const items = prev[slotId] || [""];
      if (items.length >= MAX_PER_SLOT) return prev;
      return { ...prev, [slotId]: [...items, ""] };
    });
  }

  function removeSlotItem(slotId, index) {
    setPlan((prev) => {
      const items = prev[slotId] || [""];
      return { ...prev, [slotId]: items.filter((_, i) => i !== index) };
    });
    setActivePopover(null);
  }

  function togglePopover(slotId, index) {
    setActivePopover((prev) =>
      prev?.slotId === slotId && prev?.index === index ? null : { slotId, index }
    );
  }

  function copyShareUrl() {
    const params = new URLSearchParams();
    params.set("people", String(people));
    params.set("nights", String(nights));
    for (const slot of mealSlots) {
      (plan[slot.id] || []).forEach((id, i) => {
        if (id) params.set(`${slot.id}-${i}`, id);
      });
    }
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    alert("共有URLをコピーしました");
  }

  function resetPlan() {
    setPlan(initPlan(mealSlots));
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Tsumagoi Camp / {nights}泊{nights + 1}日 / {people}人</p>
          <h1>キャンプ飯プランナー</h1>
          <p className="lead">
            レシピを朝昼晩に割り当てると、買い物リストと概算予算を自動集計します。
            GWの嬬恋村は朝晩が冷えやすい前提で、温かい肉料理・煮込み料理を多めにしています。
          </p>
        </div>
        <div className="heroCard noPrint">
          <Flame size={28} />
          <div>
            <span>概算予算</span>
            <strong>{totalCost.toLocaleString()}円</strong>
            <small>選択中レシピ / {people}人分</small>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="sectionHeader">
            <h2>食事プラン</h2>
            <div className="controls noPrint">
              <label>
                泊数
                <select value={nights} onChange={(e) => handleNightsChange(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}泊{n + 1}日</option>
                  ))}
                </select>
              </label>
              <label>
                人数
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={people}
                  onChange={(e) => setPeople(Number(e.target.value || 1))}
                />
              </label>
              <button onClick={copyShareUrl} className="secondary"><Share2 size={16} />共有URL</button>
              <button onClick={resetPlan} className="secondary"><RotateCcw size={16} />リセット</button>
              <button onClick={() => window.print()} className="secondary"><Printer size={16} />印刷</button>
            </div>
          </div>

          <div className="slots">
            {mealSlots.map((slot) => {
              const items = plan[slot.id] || [""];
              return (
                <div className="slot" key={slot.id}>
                  <div className="slotHeader">
                    <h3>{slot.label}</h3>
                    <p className="noPrint">{slot.hint}</p>
                  </div>
                  <div className="courses">
                    {items.map((selectedId, index) => {
                      const selectedName = recipes.find((r) => r.id === selectedId)?.name;
                      return (
                        <div className="courseRow" key={index}>
                          <select
                            className="noPrint"
                            value={selectedId || ""}
                            onChange={(e) => updateSlotItem(slot.id, index, e.target.value)}
                          >
                            <option value="">未選択</option>
                            {recipes.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <span className="printOnly">{selectedName || "―"}</span>
                          {selectedId && (
                            <button
                              className="infoBtn noPrint"
                              onClick={() => togglePopover(slot.id, index)}
                              aria-label="レシピ詳細"
                            >
                              <Info size={16} />
                            </button>
                          )}
                          {items.length > 1 && (
                            <button
                              className="removeBtn noPrint"
                              onClick={() => removeSlotItem(slot.id, index)}
                              aria-label="削除"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {items.length < MAX_PER_SLOT && (
                      <button className="addBtn noPrint" onClick={() => addSlotItem(slot.id)}>
                        <Plus size={13} />料理を追加
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <h2>買い物リスト</h2>
            <div className="budget"><ShoppingCart size={18} /> {shoppingList.length}品目</div>
          </div>

          {shoppingList.length === 0 ? (
            <p className="empty">レシピを選択すると、ここに買い物リストが出ます。</p>
          ) : (
            <div className="shopping">
              {categoryOrder.filter((c) => grouped[c]).map((category) => (
                <div key={category} className="category">
                  <h3>{category}</h3>
                  {grouped[category].map((item) => (
                    <label key={`${item.itemId}-${item.unit}`} className="checkItem">
                      <input type="checkbox" />
                      <span className="itemName">{item.name}</span>
                      <span className="amount">{item.amountLabel}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {uniqueSelectedRecipes.length > 0 && (
        <section className="printOnly printRecipes">
          <h2>レシピ詳細</h2>
          {uniqueSelectedRecipes.map((recipe) => (
            <div key={recipe.id} className="printRecipeItem">
              <h3>{recipe.name}</h3>
              <p>{recipe.description}</p>
              <p className="printRecipeMeta">
                {recipe.servings}人分 ／ 約{recipe.cost.toLocaleString()}円 ／ 道具: {recipe.tools.join("・")}
              </p>
              <div className="printRecipeColumns">
                <div>
                  <h4>材料</h4>
                  <ul>
                    {recipe.ingredients.map((ing, idx) => (
                      <li key={idx}>{ing.name}: {ing.amount} {ing.unit}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>手順</h4>
                  <ol>
                    {recipe.steps.map((step, idx) => <li key={idx}>{step}</li>)}
                  </ol>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="panel recipesPanel noPrint">
        <div className="sectionHeader">
          <h2>レシピ一覧</h2>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            {tags.map((tag) => <option key={tag} value={tag}>{tag === "all" ? "すべて" : tag}</option>)}
          </select>
        </div>
        <div className="recipeGrid">
          {filteredRecipes.map((recipe) => (
            <article className="recipeCard" key={recipe.id}>
              <h3>{recipe.name}</h3>
              <p>{recipe.description}</p>
              <div className="tags">
                {recipe.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <div className="meta">
                <span>{recipe.servings}人分</span>
                <span>約{recipe.cost.toLocaleString()}円</span>
              </div>
              <details>
                <summary>材料・手順を見る</summary>
                <h4>材料</h4>
                <ul>
                  {recipe.ingredients.map((ing, idx) => (
                    <li key={idx}>{ing.name}: {ing.amount} {ing.unit}</li>
                  ))}
                </ul>
                <h4>手順</h4>
                <ol>
                  {recipe.steps.map((step, idx) => <li key={idx}>{step}</li>)}
                </ol>
                <h4>道具</h4>
                <p>{recipe.tools.join(" / ")}</p>
              </details>
            </article>
          ))}
        </div>
      </section>

      <footer className="noPrint">
        <p>材料の単位は同じ単位だけ合算します。「適量」は買い忘れ防止項目として表示します。</p>
      </footer>

      {activePopover && popoverRecipe && (
        <div className="popoverOverlay" onClick={() => setActivePopover(null)}>
          <div className="popoverCard" onClick={(e) => e.stopPropagation()}>
            <div className="popoverHeader">
              <h3>{popoverRecipe.name}</h3>
              <button className="closeBtn" onClick={() => setActivePopover(null)}>✕</button>
            </div>
            <p className="popoverDesc">{popoverRecipe.description}</p>
            <div className="tags">
              {popoverRecipe.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <div className="meta">
              <span>{popoverRecipe.servings}人分</span>
              <span>約{popoverRecipe.cost.toLocaleString()}円</span>
            </div>
            <h4>材料</h4>
            <ul>
              {popoverRecipe.ingredients.map((ing, idx) => (
                <li key={idx}>{ing.name}: {ing.amount} {ing.unit}</li>
              ))}
            </ul>
            <h4>手順</h4>
            <ol>
              {popoverRecipe.steps.map((step, idx) => <li key={idx}>{step}</li>)}
            </ol>
            <h4>道具</h4>
            <p>{popoverRecipe.tools.join(" / ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
