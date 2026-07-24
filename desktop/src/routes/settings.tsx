import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useOllamaModelsQuery } from "@/lib/queries/ollama";
import { useSettingQuery, useUpdateSetting } from "@/lib/queries/settings";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionCard } from "@/shared/components/ui/section-card";

const OLLAMA_MODEL_KEY = "ollama_default_model";
const RUN_IN_BACKGROUND_KEY = "run_in_background";

export function Settings() {
  const modelSetting = useSettingQuery(OLLAMA_MODEL_KEY);
  const backgroundSetting = useSettingQuery(RUN_IN_BACKGROUND_KEY);
  const models = useOllamaModelsQuery();
  const updateSetting = useUpdateSetting();

  const [model, setModel] = useState("");
  const [runInBackground, setRunInBackground] = useState(false);

  useEffect(() => {
    if (typeof modelSetting.data?.value === "string") {
      setModel(modelSetting.data.value);
    }
  }, [modelSetting.data?.value]);

  useEffect(() => {
    setRunInBackground(backgroundSetting.data?.value === true);
  }, [backgroundSetting.data?.value]);

  async function saveModel() {
    await updateSetting.mutateAsync({ key: OLLAMA_MODEL_KEY, value: model });
  }

  async function saveRunInBackground(value: boolean) {
    setRunInBackground(value);
    await updateSetting.mutateAsync({ key: RUN_IN_BACKGROUND_KEY, value });
  }

  return (
    <section className="bg-background h-full min-h-0 overflow-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
        <header>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
            Preferences
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Configure app behavior. Message sources and account sessions are managed in Connectors.
          </p>
        </header>

        <SectionCard
          title="Draft generation"
          description="Default local model used for new draft generations."
        >
          <div className="flex max-w-2xl flex-col gap-3">
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gemma3:4b"
            />
            {models.data?.length ? (
              <div className="flex flex-wrap gap-2">
                {models.data.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setModel(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {models.isError
                  ? "Ollama models are unavailable."
                  : "Installed models will appear here when Ollama is reachable."}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => void saveModel()}
                disabled={!model || updateSetting.isPending}
              >
                {updateSetting.isPending ? "Saving..." : "Save model"}
              </Button>
              {updateSetting.isSuccess ? (
                <span className="text-muted-foreground text-xs">Saved</span>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Background behavior"
          description="Choose what Draftlet should do after the window closes."
        >
          <label className="bg-background flex max-w-3xl items-start gap-3 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={runInBackground}
              onChange={(event) => void saveRunInBackground(event.target.checked)}
              className="border-input mt-1 size-4 rounded"
            />
            <span>
              <span className="block font-medium">Run in background</span>
              <span className="text-muted-foreground mt-1 block">
                Keep Draftlet running in the background so connected sources can continue capturing.
              </span>
              {updateSetting.isPending ? (
                <span className="text-muted-foreground mt-1 block text-xs">Saving...</span>
              ) : null}
            </span>
          </label>
        </SectionCard>

        <SectionCard
          title="Message sources"
          description="Connect Gmail and Telegram from the Connectors page."
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground max-w-xl text-sm">
              Manage source connections and check recent capture activity in one place.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/connectors">Open Connectors</Link>
            </Button>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}
