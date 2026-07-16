import { FileText, Mail } from "lucide-react";

import { InspectorSection } from "@/modules/draft-workspace/components/inspector-section";
import { SegmentedControl } from "@/modules/draft-workspace/components/segmented-control";
import type { DraftSettings, DraftSource } from "@/modules/draft-workspace/types";
import { coverageOptions, lengthOptions, toneOptions } from "@/modules/draft-workspace/utils";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import type { Coverage, Length, Tone } from "@/lib/contracts";

export interface ContextPanelProps {
  source: DraftSource;
  settings: DraftSettings;
  onToneChange: (value: Tone) => void;
  onLengthChange: (value: Length) => void;
  onCoverageChange: (value: Coverage) => void;
  selectedMessages: Array<{ author: string; detail: string }>;
  references: string[];
}

export function ContextPanel({
  source,
  settings,
  onToneChange,
  onLengthChange,
  onCoverageChange,
  selectedMessages,
  references,
}: ContextPanelProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-muted/50">
      <div className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Context
        </p>
        <h2 className="mt-1 truncate text-sm font-semibold tracking-tight">{source.title}</h2>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span className="min-w-0 truncate">
              {source.connector} · {source.contact}
            </span>
          </div>

          <InspectorSection title="Draft settings">
            <div className="space-y-4">
              <SegmentedControl
                label="Tone"
                options={toneOptions}
                value={settings.tone}
                onChange={onToneChange}
              />
              <SegmentedControl
                label="Length"
                options={lengthOptions}
                value={settings.length}
                onChange={onLengthChange}
              />
              <SegmentedControl
                label="Coverage"
                options={coverageOptions}
                value={settings.coverage}
                onChange={onCoverageChange}
              />
            </div>
          </InspectorSection>

          <InspectorSection title="Selected messages">
            {selectedMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No source messages selected.</p>
            ) : (
              <div className="space-y-3">
                {selectedMessages.map((message) => (
                  <div key={message.detail}>
                    <p className="text-sm font-medium">{message.author}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{message.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </InspectorSection>

          <InspectorSection title="References">
            <div className="space-y-2">
              {references.map((reference) => (
                <div key={reference} className="flex items-center gap-2 text-sm">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>{reference}</span>
                </div>
              ))}
            </div>
          </InspectorSection>
        </div>
      </ScrollArea>
    </aside>
  );
}
