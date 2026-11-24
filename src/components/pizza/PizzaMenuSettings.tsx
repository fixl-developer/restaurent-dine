import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCan } from "@/components/auth/Can";
import type { ModifierDto, ModifierGroupDto } from "@/lib/dto/menu";
import {
  pizzaIngredients,
  type PizzaArt,
  type PizzaBuilderConfig,
} from "./ingredients";

type Option = Omit<ModifierDto, "_id"> & { _id?: string };
const field =
  "block w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white";
const button =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold";

function GroupEditor({
  group,
  onSaved,
  onCancel,
}: {
  group?: ModifierGroupDto;
  onSaved: (g: ModifierGroupDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "Pizza toppings");
  const [limit, setLimit] = useState(group?.maxSelections ?? 7);
  const [options, setOptions] = useState<Option[]>(
    () =>
      group?.modifiers.map((m) => ({ ...m })) ??
      (Object.keys(pizzaIngredients) as PizzaArt[])
        .filter((a) => a !== "pepperoni")
        .map((a) => ({
          name: pizzaIngredients[a],
          pizzaArt: a,
          priceDelta: 0,
          isDefault: a === "mozzarella",
          is86: false,
        })),
  );
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        maxSelections: limit,
        modifiers: options.map((m) => ({ ...m, name: m.name.trim() })),
      };
      return group
        ? api.patch<ModifierGroupDto>("/modifier-groups/" + group._id, payload)
        : api.post<ModifierGroupDto>("/modifier-groups", {
            ...payload,
            isRequired: false,
            minSelections: 0,
          });
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["menu", "modifier-groups"] });
      qc.invalidateQueries({ queryKey: ["public-menu"] });
      onSaved(g);
      toast.success("Topping group saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = (index: number, change: Partial<Option>) =>
    setOptions((list) =>
      list.map((o, i) => (i === index ? { ...o, ...change } : o)),
    );
  const valid =
    name.trim() &&
    options.length > 0 &&
    options.every((m) => m.name.trim() && Number.isFinite(m.priceDelta)) &&
    Number.isInteger(limit) &&
    limit >= Math.max(1, group?.minSelections ?? 0) &&
    options.filter((m) => m.isDefault && !m.is86).length <= limit;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm">
        Saving updates this topping group on every item that uses it.
      </p>
      <label className="block text-sm">
        Group name
        <input
          className={field}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Maximum selections
        <input
          className={field}
          type="number"
          min={Math.max(1, group?.minSelections ?? 0)}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </label>
      {options.map((m, i) => (
        <fieldset
          key={m._id ?? "new-" + i}
          className="grid grid-cols-2 gap-2 bg-white border rounded-lg p-2 text-sm"
        >
          <legend className="px-1">{m.name || "New topping"}</legend>
          <label>
            Name
            <input
              className={field}
              value={m.name}
              maxLength={60}
              onChange={(e) => patch(i, { name: e.target.value })}
            />
          </label>
          <label>
            Extra price
            <input
              className={field}
              type="number"
              step=".01"
              value={m.priceDelta}
              onChange={(e) =>
                patch(i, { priceDelta: e.target.valueAsNumber || 0 })
              }
            />
          </label>
          <label className="col-span-2">
            Artwork
            <select
              className={field}
              value={m.pizzaArt ?? ""}
              onChange={(e) =>
                patch(i, {
                  pizzaArt: (e.target.value || null) as PizzaArt | null,
                })
              }
            >
              <option value="">Text only</option>
              {Object.entries(pizzaIngredients).map(([art, label]) => (
                <option key={art} value={art}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={m.isDefault}
              onChange={(e) => patch(i, { isDefault: e.target.checked })}
            />{" "}
            Selected by default
          </label>
          <label>
            <input
              type="checkbox"
              checked={m.is86}
              onChange={(e) => patch(i, { is86: e.target.checked })}
            />{" "}
            Sold out
          </label>
          <button
            type="button"
            className="text-left text-xs underline"
            onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
          >
            Remove topping
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className={button}
        disabled={options.length >= 40}
        onClick={() =>
          setOptions((o) => [
            ...o,
            { name: "", priceDelta: 0, isDefault: false, is86: false },
          ])
        }
      >
        Add topping
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
        >
          Save topping group
        </button>
        <button type="button" onClick={onCancel}>
          Cancel group edits
        </button>
      </div>
    </div>
  );
}
export default function PizzaMenuSettings({
  config,
  onChange,
  groups,
  onAttach,
}: {
  config?: PizzaBuilderConfig | null;
  onChange: (c: PizzaBuilderConfig | null) => void;
  groups: ModifierGroupDto[];
  onAttach: (id: string) => void;
}) {
  const [editor, setEditor] = useState<string | null>(null);
  const canCreate = useCan("menu:create"),
    canUpdate = useCan("menu:update");
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <label className="block text-sm font-semibold">
        Customization view
        <select
          className={field}
          value={config?.enabled ? "pizza" : "standard"}
          onChange={(e) => {
            onChange(e.target.value === "pizza" ? { enabled: true } : null);
            setEditor(null);
          }}
        >
          <option value="standard">Standard</option>
          <option value="pizza">Visual pizza builder</option>
        </select>
      </label>
      {config?.enabled && (
        <>
          <label className="block text-sm">
            Base image URL <span className="text-gray-500">(optional)</span>
            <input
              className={field}
              type="url"
              placeholder="Use the house tomato base"
              value={config.baseImageUrl ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  baseImageUrl: e.target.value.trim() || undefined,
                })
              }
            />
          </label>
          <p className="text-sm">
            Use a square, top-down base with transparent edges. Attach an
            existing modifier group below or create one here.
          </p>
          {editor === null ? (
            <div className="flex flex-wrap gap-2">
              {canUpdate &&
                groups.map((g) => (
                  <button
                    type="button"
                    key={g._id}
                    className={button}
                    onClick={() => setEditor(g._id)}
                  >
                    Edit {g.name}
                  </button>
                ))}
              {canCreate && (
                <button
                  type="button"
                  className={button}
                  onClick={() => setEditor("new")}
                >
                  Create topping group
                </button>
              )}
            </div>
          ) : (
            <GroupEditor
              key={editor}
              group={groups.find((g) => g._id === editor)}
              onCancel={() => setEditor(null)}
              onSaved={(g) => {
                if (editor === "new") onAttach(g._id);
                setEditor(null);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
