import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";

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
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

const phoneSchema = z.object({
  phone: z.string().trim().min(4, "Enter your Telegram phone number."),
});

const codeSchema = z.object({
  code: z.string().trim().min(2, "Enter the login code."),
});

const passwordSchema = z.object({
  password: z.string().min(1, "Enter your 2FA password."),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

interface TelegramConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TelegramConnectModal({ open, onOpenChange }: TelegramConnectModalProps) {
  const queryClient = useQueryClient();
  const auth = useTelegramAuthStatusQuery();
  const qrStatus = useTelegramQrStatusQuery(open);
  const startPhone = useStartTelegramAuth();
  const signIn = useSignInTelegram();
  const signInPassword = useSignInTelegramPassword();
  const startQr = useStartTelegramQr();
  const cancelQr = useCancelTelegramQr();
  const phoneForm = useForm<PhoneForm>({
    resolver: standardSchemaResolver(phoneSchema),
    mode: "onChange",
    defaultValues: { phone: "" },
  });
  const codeForm = useForm<CodeForm>({
    resolver: standardSchemaResolver(codeSchema),
    mode: "onChange",
    defaultValues: { code: "" },
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: standardSchemaResolver(passwordSchema),
    mode: "onChange",
    defaultValues: { password: "" },
  });
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
  const phone = phoneForm.watch("phone");

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
          <div className="bg-card/50 rounded-lg border p-4">
            <p className="text-sm font-medium">Connected{username ? ` as ${username}` : ""}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Draftlet can now ingest new incoming Telegram messages into the local runtime.
            </p>
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="phone" className="min-h-90">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">Phone</TabsTrigger>
              <TabsTrigger value="qr">QR code</TabsTrigger>
            </TabsList>

            <TabsContent value="phone" className="space-y-4 pt-3">
              <form
                className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
                onSubmit={phoneForm.handleSubmit(({ phone }) => startPhone.mutate(phone))}
              >
                <Controller
                  control={phoneForm.control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="telegram-phone">Phone number</FieldLabel>
                      <Input
                        id="telegram-phone"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="+15551234567"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError>{fieldState.error?.message}</FieldError>
                    </Field>
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="sm:mt-6"
                  disabled={!phoneForm.formState.isValid || pending}
                >
                  Send code
                </Button>
              </form>

              <AuthHint
                error={auth.data?.error}
                delivery={auth.data?.delivery}
                nextDelivery={auth.data?.next_delivery}
                length={auth.data?.length}
                timeout={auth.data?.timeout}
              />

              <form
                className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
                onSubmit={codeForm.handleSubmit(({ code }) =>
                  signIn.mutate({ phone, code, phoneCodeHash }),
                )}
              >
                <Controller
                  control={codeForm.control}
                  name="code"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="telegram-code">Login code</FieldLabel>
                      <Input
                        id="telegram-code"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="12345"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError>{fieldState.error?.message}</FieldError>
                    </Field>
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="sm:mt-6"
                  disabled={!phone || !codeForm.formState.isValid || pending}
                >
                  Sign in
                </Button>
              </form>

              <form
                className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start"
                onSubmit={passwordForm.handleSubmit(({ password }) =>
                  signInPassword.mutate(password),
                )}
              >
                <Controller
                  control={passwordForm.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="telegram-password">2FA password</FieldLabel>
                      <Input
                        id="telegram-password"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Only if Telegram asks"
                        type="password"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError>{fieldState.error?.message}</FieldError>
                    </Field>
                  )}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="sm:mt-6"
                  disabled={
                    !passwordForm.formState.isValid ||
                    pending ||
                    auth.data?.state !== "awaiting_password"
                  }
                >
                  Submit 2FA
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="qr" className="space-y-4 pt-3">
              <div className="bg-card/50 rounded-lg border p-4 text-sm">
                <p className="font-medium">Scan from Telegram</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  Open Telegram on your phone, go to Settings {"->"} Devices {"->"} Link Desktop
                  Device, then scan this code.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-lg border p-4">
                {qrUrl && qrState !== "expired" ? (
                  <QrCode value={qrUrl} />
                ) : (
                  <div className="bg-muted text-muted-foreground flex size-61 items-center justify-center rounded-lg text-sm">
                    No active QR
                  </div>
                )}
                <p className="text-muted-foreground text-center text-xs">
                  {qrState === "expired"
                    ? "This QR code expired. Generate a new one."
                    : qrUrl
                      ? `Waiting for scan${qrExpiresIn ? ` · expires in ${qrExpiresIn}s` : ""}`
                      : "Generate a QR code to start."}
                </p>
                {qrStatus.data?.error ? (
                  <p className="text-destructive text-xs">{qrStatus.data.error}</p>
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

export interface AuthHintProps {
  error?: string | null;
  delivery?: string | null;
  nextDelivery?: string | null;
  length?: number | null;
  timeout?: number | null;
}

function AuthHint({ error, delivery, nextDelivery, length, timeout }: AuthHintProps) {
  if (error) {
    return (
      <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-xs">
        {error}
      </p>
    );
  }
  if (!delivery) {
    return (
      <p className="text-muted-foreground text-xs">
        Send a code first. Telegram usually delivers it to the official Telegram chat in your app.
      </p>
    );
  }
  return (
    <p className="bg-card/50 text-muted-foreground rounded-lg border px-3 py-2 text-xs leading-5">
      Telegram chose {delivery}. Check the official Telegram chat in your app.
      {nextDelivery ? ` Alternate delivery: ${nextDelivery}.` : ""}
      {length ? ` Code length: ${length} digits.` : ""}
      {timeout ? ` Timeout: ${timeout}s.` : ""}
    </p>
  );
}
