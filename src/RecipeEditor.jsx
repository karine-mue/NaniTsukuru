import React, { useState } from "react";
import { Plus, X } from "lucide-react";

const CATEGORIES = ["肉・魚", "野菜", "果物", "卵", "乳製品", "主食", "缶詰・乾物", "菓子", "調味料", "消耗品", "その他"];

function parseIngredientLine(line) {
  const t = line.trim();
  if (!t) return null;
  const freeMatch = t.match(/^(.+?)\s+(適量|少々|少量|ひとつまみ|お好みで)$/);
  if (freeMatch) return { name: freeMatch[1].trim(), amount: freeMatch[2], unit: "適量", itemId: "", category: "" };
  const numMatch = t.match(/^(.+?)\s+([\d.]+)\s*([^\s\d].+)$/);
  if (numMatch) return { name: numMatch[1].trim(), amount: parseFloat(numMatch[2]), unit: numMatch[3].trim(), itemId: "", category: "" };
  return { name: t, amount: "", unit: "", itemId: "", category: "" };
}

function suggestItemId(name, allRecipes) {
  for (const r of allRecipes) {
    const found = (r.ingredients || []).find((ing) => ing.name === name);
    if (found) return found.itemId;
  }
  return name.trim().replace(/\s+/g, "_");
}

export default function RecipeEditor({ allRecipes, onSave, onClose }) {
  const [name, setName] = useState("");
  const [servings, setServings] = useState(2);
  const [cost, setCost] = useState(0);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [tools, setTools] = useState("");
  const [steps, setSteps] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [errors, setErrors] = useState([]);

  function parsePaste() {
    const parsed = pasteText.split("\n").map(parseIngredientLine).filter(Boolean);
    setIngredients((prev) => [
      ...prev,
      ...parsed.map((ing) => ({ ...ing, itemId: suggestItemId(ing.name, allRecipes) }))
    ]);
    setPasteText("");
  }

  function updateIngredient(i, field, value) {
    setIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  }

  function removeIngredient(i) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addEmptyIngredient() {
    setIngredients((prev) => [...prev, { name: "", amount: "", unit: "", itemId: "", category: "" }]);
  }

  function handleSave() {
    const errs = [];
    if (!name.trim()) errs.push("名前を入力してください");
    if (ingredients.length === 0) errs.push("材料を1つ以上追加してください");
    if (errs.length) { setErrors(errs); return; }

    onSave({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      servings: Number(servings) || 2,
      cost: Number(cost) || 0,
      tags: tags.split(/[,、\s]+/).map((t) => t.trim()).filter(Boolean),
      description: description.trim(),
      tools: tools.split(/[,、]+/).map((t) => t.trim()).filter(Boolean),
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      ingredients: ingredients.map((ing) => ({
        itemId: ing.itemId || ing.name.trim().replace(/\s+/g, "_"),
        name: ing.name,
        amount: isNaN(parseFloat(ing.amount)) ? ing.amount : parseFloat(ing.amount),
        unit: ing.unit,
        category: ing.category || "その他"
      }))
    });
  }

  return (
    <div className="popoverOverlay" onClick={onClose}>
      <div className="editorModal" onClick={(e) => e.stopPropagation()}>
        <div className="popoverHeader">
          <h3>レシピを追加</h3>
          <button className="closeBtn" onClick={onClose}>✕</button>
        </div>

        {errors.length > 0 && (
          <div className="editorErrors">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        <div className="editorBody">
          <div className="editorSection">
            <h4>基本情報</h4>
            <div className="editorField">
              <label>名前 *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="レシピ名" />
            </div>
            <div className="editorRow">
              <div className="editorField">
                <label>人数</label>
                <input type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
              <div className="editorField">
                <label>費用目安（円）</label>
                <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>
            <div className="editorField">
              <label>タグ <small>カンマ区切り</small></label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="夜向け, 肉, 簡単" />
            </div>
            <div className="editorField">
              <label>説明</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="editorField">
              <label>道具 <small>カンマ区切り</small></label>
              <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="スキレット, バーナー" />
            </div>
            <div className="editorField">
              <label>手順 <small>1行1ステップ</small></label>
              <textarea rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={"肉を焼く。\n野菜を加える。"} />
            </div>
          </div>

          <div className="editorSection">
            <h4>材料</h4>
            <div className="editorField">
              <label>貼り付け入力 <small>「名前 量単位」を1行ずつ</small></label>
              <textarea
                rows={3}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"牛すじ 500g\n玉ねぎ 2個\n塩こしょう 適量"}
              />
              <button className="secondary" onClick={parsePaste} disabled={!pasteText.trim()}>
                解析して追加
              </button>
            </div>

            {ingredients.length > 0 && (
              <div className="ingredientTable">
                <div className="ingredientHeader">
                  <span>名前</span><span>量</span><span>単位</span><span>カテゴリ</span><span />
                </div>
                {ingredients.map((ing, i) => (
                  <div key={i} className="ingredientRow">
                    <input value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="材料名" />
                    <input value={ing.amount} onChange={(e) => updateIngredient(i, "amount", e.target.value)} placeholder="量" />
                    <input value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} placeholder="単位" />
                    <select value={ing.category} onChange={(e) => updateIngredient(i, "category", e.target.value)}>
                      <option value="">カテゴリ</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button className="removeBtn" onClick={() => removeIngredient(i)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <button className="addBtn" onClick={addEmptyIngredient}>
              <Plus size={13} />行を追加
            </button>
          </div>
        </div>

        <div className="editorFooter">
          <button className="secondary" onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={handleSave}>保存する</button>
        </div>
      </div>
    </div>
  );
}
