import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShoppingCart, Flame, Share2, RotateCcw } from "lucide-react";
import recipes from "./recipes.json";
import "./styles.css";

const courseTypes = [
  { id: "main", label: "主菜" },
  { id: "side", label: "副菜" },
  { id: "soup", label: "スープ" },
];

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
  return Object.fromEntries(
    slots.map((slot) => [slot.id, Object.fromEntries(courseTypes.map((c) => [c.id, ""]))])
  );
}

function parsePlanFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const nights = Number(params.get("nights") || 2);
  const validNights = [1, 2, 3, 4].includes(nights) ? nights : 2;
  const people = Number(params.get("people") || 2);
  const slots = generateMealSlots(validNights);
  const plan = initPlan(slots);
  for (const slot of slots) {
    for (const course of courseTypes) {
      const val = params.get(`${slot.id}-${course.id}`);
      if (val) plan[slot.id][course.id] = val;
    }
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

  const mealSlots = useMemo(() => generateMealSlots(nights), [nights]);

  const tags = useMemo(() => {
    return ["all", ...Array.from(new Set(recipes.flatMap((r) => r.tags))).sort((a, b) => a.localeCompare(b, "ja"))];
  }, []);

  const allSelectedRecipes = useMemo(() => {
    const result = [];
    for (const slot of mealSlots) {
      for (const course of courseTypes) {
        const id = plan[slot.id]?.[course.id];
        if (id) {
          const recipe = recipes.find((r) => r.id === id);
          if (recipe) result.push(recipe);
        }
      }
    }
    return result;
  }, [plan, mealSlots]);

  const totalCost = useMemo(() => {
    return allSelectedRecipes.reduce((sum, r) => sum + Math.round(r.cost * (people / r.servings)), 0);
  }, [allSelectedRecipes, people]);

  const shoppingList = useMemo(() => buildShoppingList(allSelectedRecipes, people), [allSelectedRecipes, people]);
  const grouped = groupByCategory(shoppingList);

  const filteredRecipes = recipes.filter((r) => tagFilter === "all" || r.tags.includes(tagFilter));

  function handleNightsChange(newNights) {
    const newSlots = generateMealSlots(newNights);
    setPlan((prev) => {
      const next = {};
      for (const slot of newSlots) {
        next[slot.id] = prev[slot.id] ?? Object.fromEntries(courseTypes.map((c) => [c.id, ""]));
      }
      return next;
    });
    setNights(newNights);
  }

  function updateSlot(slotId, courseId, recipeId) {
    setPlan((prev) => ({
      ...prev,
      [slotId]: { ...(prev[slotId] || {}), [courseId]: recipeId }
    }));
  }

  function copyShareUrl() {
    const params = new URLSearchParams();
    params.set("people", String(people));
    params.set("nights", String(nights));
    for (const slot of mealSlots) {
      for (const course of courseTypes) {
        const val = plan[slot.id]?.[course.id];
        if (val) params.set(`${slot.id}-${course.id}`, val);
      }
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
        <div className="heroCard">
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
            <h2>食事枠にレシピを割り当て</h2>
            <div className="controls">
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
            </div>
          </div>

          <div className="slots">
            {mealSlots.map((slot) => (
              <div className="slot" key={slot.id}>
                <div className="slotHeader">
                  <h3>{slot.label}</h3>
                  <p>{slot.hint}</p>
                </div>
                <div className="courses">
                  {courseTypes.map((course) => (
                    <div className="courseRow" key={course.id}>
                      <span className="courseLabel">{course.label}</span>
                      <select
                        value={plan[slot.id]?.[course.id] || ""}
                        onChange={(e) => updateSlot(slot.id, course.id, e.target.value)}
                      >
                        <option value="">未選択</option>
                        {recipes.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

      <section className="panel recipesPanel">
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

      <footer>
        <p>材料の単位は同じ単位だけ合算します。「適量」は買い忘れ防止項目として表示します。</p>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
