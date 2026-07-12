import { useEffect, useState } from "react";

import { useOllamaModelsQuery } from "@/lib/queries/ollama";
import { useSettingQuery, useUpdateSetting } from "@/lib/queries/settings";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionCard } from "@/shared/components/ui/section-card";

const OLLAMA_MODEL_KEY = "ollama_default_model";

export function Settings() {
  const setting = useSettingQuery(OLLAMA_MODEL_KEY);
  const models = useOllamaModelsQuery();
  const updateSetting = useUpdateSetting();
  const [model, setModel] = useState("");

  useEffect(() => {
    if (typeof setting.data?.value === "string") {
      setModel(setting.data.value);
    }
  }, [setting.data?.value]);

  async function save() {
    await updateSetting.mutateAsync({ key: OLLAMA_MODEL_KEY, value: model });
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 overflow-auto px-6 py-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Runtime preferences
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Configure the local runtime values used by draft generation.
        </p>
      </header>

      <SectionCard title="Ollama model" description="Default local model used for new draft generations.">
        <div className="flex max-w-2xl flex-col gap-3">
          <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gemma3:4b" />
          {models.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {models.data.map((name) => (
                <Button key={name} type="button" variant="secondary" size="sm" onClick={() => setModel(name)}>
                  {name}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {models.isError ? "Ollama models are unavailable." : "Installed models will appear here when Ollama is reachable."}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={() => void save()} disabled={!model || updateSetting.isPending}>
              {updateSetting.isPending ? "Saving..." : "Save model"}
            </Button>
            {updateSetting.isSuccess ? <span className="text-xs text-muted-foreground">Saved</span> : null}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
