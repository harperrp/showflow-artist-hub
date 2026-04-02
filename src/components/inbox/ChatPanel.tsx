import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Conversation, Message } from "@/types/crm";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  onSend: (text: string) => void;
  sending: boolean;
}

function formatDateLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; msgs: Message[] }[] = [];
  let lastLabel = "";
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    if (label !== lastLabel) {
      groups.push({ label, msgs: [msg] });
      lastLabel = label;
    } else {
      groups[groups.length - 1].msgs.push(msg);
    }
  }
  return groups;
}

export function ChatPanel({ conversation, messages, onSend, sending }: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center bg-accent/20 text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium">Selecione uma conversa</p>
          <p className="mt-1 text-xs text-muted-foreground">Escolha um contato à esquerda para começar</p>
        </div>
      </div>
    );
  }

  const grouped = groupByDate(messages);

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <div className="flex h-11 items-center border-b border-border bg-card px-4 shrink-0 gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
          <span className="text-[11px] font-semibold text-primary">
            {(conversation.contact_name || conversation.contact_phone || "?")[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {conversation.contact_name || conversation.contact_phone}
          </p>
          <p className="text-[10px] text-muted-foreground">{conversation.contact_phone}</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-accent/10"
        style={{ scrollBehavior: "auto" }}
      >
        <div className="mx-auto w-full max-w-[760px] px-4 py-3 pb-2 min-h-full">
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {group.label}
                </span>
              </div>
              {group.msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "mb-2 flex",
                    msg.direction === "inbound" ? "justify-start" : "justify-end"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-3 py-2 text-sm",
                      msg.direction === "inbound"
                        ? "rounded-bl-md border border-border bg-card text-foreground shadow-card"
                        : "rounded-br-md bg-primary text-primary-foreground shadow-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                      {msg.message_text}
                    </p>
                    {msg.media_url && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-[11px] underline opacity-90">
                        Ver mídia ({msg.message_type})
                      </a>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-right text-[10px]",
                        msg.direction === "inbound"
                          ? "text-muted-foreground"
                          : "text-primary-foreground/60"
                      )}
                    >
                      {format(parseISO(msg.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-card px-3 py-2 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }}
          className="mx-auto flex max-w-[760px] items-center gap-2"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="h-9 flex-1 border-transparent bg-secondary/50 text-sm focus:border-border"
            autoFocus
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={!text.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
