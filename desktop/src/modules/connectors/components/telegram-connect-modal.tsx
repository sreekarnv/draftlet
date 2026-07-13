import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { QrCode } from "@/components/qr-code";
import {
  useCancelTelegramQr,
  useSignInTelegram,
  useSignInTelegramPassword,
  useStartTelegramAuth,
  useStartTelegramQr,
  useTelegramAuthStatusQuery,
  useTelegramQrStatusQuery,
} from "@/lib/queries/connectors";
import { queryKeys } from "@/lib/queries/keys";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

export function TelegramConnectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const auth = useTelegramAuthStatusQuery();
  const qrStatus = useTelegramQrStatusQuery(open);
  const startPhone = useStartTelegramAuth();
  const signIn = useSignInTelegram();
  const signInPassword = useSignInTelegramPassword();
  const startQr = useStartTelegramQr();
  const cancelQr = useCancelTelegramQr();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const pending =
    startPhone.isPending ||
    signIn.isPending ||
    signInPassword.isPending ||
    startQr.isPending ||
    cancelQr.isPending;
  const connected = auth.data?.connected || qrStatus.data?.connected;
  const username = auth.data?.username ?? qrStatus.data?.username;
  const phoneCodeHash = auth.data?.phone_code_hash;
  const qrState = qrStatus.data?.state ?? (qrUrl ? "awaiting_qr" : "idle");
  const qrExpiresIn = qrStatus.data?.expires_in ?? startQr.data?.expires_in;

  useEffect(() => {
    if (qrStatus.data?.connected) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    }
  }, [queryClient, qrStatus.data?.connected]);

  async function startQrFlow() {
    const result = await startQr.mutateAsync();
    setQrUrl(result.url);
  }

  function close() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>Connect Telegram</DialogTitle>
          <DialogDescription>
            Sign in with your Telegram account using a phone code or a QR code. This is not a bot
            login.
          </DialogDescription>
        </DialogHeader>

        {connected ? (
          <div className="rounded-lg border bg-card/50 p-4">
            <p className="text-sm font-medium">Connected{username ? ` as ${username}` : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Draftlet can now ingest new incoming Telegram messages into the local runtime.
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="phone" className="min-h-[360px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">Phone</TabsTrigger>
              <TabsTrigger value="qr">QR code</TabsTrigger>
            </TabsList>

            <TabsContent value="phone" className="space-y-4 pt-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  Phone number
                  <Input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+15551234567"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!phone || pending}
                  onClick={() => startPhone.mutate(phone)}
                >
                  Send code
                </Button>
              </div>

              <AuthHint
                error={auth.data?.error}
                delivery={auth.data?.delivery}
                nextDelivery={auth.data?.next_delivery}
                length={auth.data?.length}
                timeout={auth.data?.timeout}
              />

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  Login code
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="12345"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!phone || !code || pending}
                  onClick={() => signIn.mutate({ phone, code, phoneCodeHash })}
                >
                  Sign in
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  2FA password
                  <Input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Only if Telegram asks"
                    type="password"
                  />
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!password || pending || auth.data?.state !== "awaiting_password"}
                  onClick={() => signInPassword.mutate(password)}
                >
                  Submit 2FA
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="qr" className="space-y-4 pt-3">
              <div className="rounded-lg border bg-card/50 p-4 text-sm">
                <p className="font-medium">Scan from Telegram</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Open Telegram on your phone, go to Settings {"->"} Devices {"->"} Link Desktop
                  Device, then scan this code.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
                {qrUrl && qrState !== "expired" ? (
                  <QrCode value={qrUrl} />
                ) : (
                  <div className="flex size-[244px] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                    No active QR
                  </div>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  {qrState === "expired"
                    ? "This QR code expired. Generate a new one."
                    : qrUrl
                      ? `Waiting for scan${qrExpiresIn ? ` · expires in ${qrExpiresIn}s` : ""}`
                      : "Generate a QR code to start."}
                </p>
                {qrStatus.data?.error ? (
                  <p className="text-xs text-destructive">{qrStatus.data.error}</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                {qrUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      cancelQr.mutate();
                      setQrUrl(null);
                    }}
                  >
                    Cancel QR
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => void startQrFlow()}
                >
                  {qrState === "expired" ? "Regenerate" : qrUrl ? "Regenerate" : "Show QR"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuthHint({
  error,
  delivery,
  nextDelivery,
  length,
  timeout,
}: {
  error?: string | null;
  delivery?: string | null;
  nextDelivery?: string | null;
  length?: number | null;
  timeout?: number | null;
}) {
  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </p>
    );
  }
  if (!delivery) {
    return (
      <p className="text-xs text-muted-foreground">
        Send a code first. Telegram usually delivers it to the official Telegram chat in your app.
      </p>
    );
  }
  return (
    <p className="rounded-lg border bg-card/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
      Telegram chose {delivery}. Check the official Telegram chat in your app.
      {nextDelivery ? ` Alternate delivery: ${nextDelivery}.` : ""}
      {length ? ` Code length: ${length} digits.` : ""}
      {timeout ? ` Timeout: ${timeout}s.` : ""}
    </p>
  );
}
