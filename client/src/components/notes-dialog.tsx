import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Plus, Pencil, Trash2, Quote, ChevronsRight, FileText, Lock, Lightbulb } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/translations";
import type { Note } from "@shared/schema";

const MAX_NOTE_LENGTH = 1000;

type View = "list" | "add";

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verseId: string | null;
  /** Full human-readable reference, e.g. "Īśāvāsya Upaniṣad 1.1.1". */
  verseReference: string;
  /** Short verse label shown on each note card, e.g. "1.1.1". */
  verseLabel: string;
  initialView?: View;
  initialSelectedText?: string | null;
  languageCode?: string | null;
}

function formatNoteDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotesDialog({
  open,
  onOpenChange,
  verseId,
  verseReference,
  verseLabel,
  initialView = "list",
  initialSelectedText = null,
  languageCode,
}: NotesDialogProps) {
  const { t } = useTranslation(languageCode ?? null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<View>(initialView);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(initialSelectedText);

  // Reset internal state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setView(initialView);
      setContent("");
      setEditingId(null);
      setSelectedText(initialSelectedText ?? null);
    }
  }, [open, initialView, initialSelectedText]);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/verses", verseId, "notes"],
    enabled: isAuthenticated && !!verseId && open,
  });

  const createMutation = useMutation({
    mutationFn: async ({ content, selectedText }: { content: string; selectedText?: string | null }) => {
      const res = await apiRequest("POST", `/api/verses/${verseId}/notes`, { content, selectedText: selectedText || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      resetForm();
      setView("list");
    },
    onError: (err: Error) => {
      toast({ title: t("noteSaveFailed"), description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      resetForm();
      setView("list");
    },
    onError: (err: Error) => {
      toast({ title: t("noteSaveFailed"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
    },
    onError: (err: Error) => {
      toast({ title: t("noteSaveFailed"), description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setContent("");
    setEditingId(null);
    setSelectedText(null);
  }

  function openAddView() {
    resetForm();
    setView("add");
  }

  function openEditView(note: Note) {
    setEditingId(note.id);
    setContent(note.content);
    setSelectedText(note.selectedText ?? null);
    setView("add");
  }

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, content: trimmed });
    } else {
      createMutation.mutate({ content: trimmed, selectedText });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const loginPrompt = (
    <div className="py-6 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <StickyNote className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{t("loginToAddNotes")}</p>
      <Button onClick={() => { window.location.href = "/auth"; }} data-testid="button-login-for-notes">
        {t("logIn")}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" data-testid="notes-dialog">
        {!isAuthenticated ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-xl">{t("myNotes")}</DialogTitle>
            </DialogHeader>
            {loginPrompt}
          </div>
        ) : view === "add" ? (
          <div>
            <div className="p-6 pb-4">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingId ? t("editNote") : t("addNote")}
                </DialogTitle>
              </DialogHeader>
            </div>

            <div className="px-6 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("verseReference")}</p>
                <div className="flex items-center gap-2.5 rounded-lg bg-muted/60 px-3.5 py-3 text-sm" data-testid="note-verse-reference">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">{verseReference}</span>
                </div>
              </div>

              {selectedText && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                  <Quote className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                  <p className="font-body text-muted-foreground italic line-clamp-3" data-testid="note-selected-quote">{selectedText}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">{t("yourNote")}</p>
                <div className="relative">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                    placeholder={t("writeNoteHere")}
                    className="min-h-[150px] resize-none pb-6"
                    maxLength={MAX_NOTE_LENGTH}
                    autoFocus
                    data-testid="input-note-content"
                  />
                  <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground/70">
                    {content.length}/{MAX_NOTE_LENGTH}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 px-3.5 py-3 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p>{t("notesPrivateInfo")}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-6 pt-4">
              <Button
                variant="outline"
                onClick={() => { resetForm(); if (notes.length > 0) { setView("list"); } else { onOpenChange(false); } }}
                data-testid="button-cancel-note"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!content.trim() || isSaving}
                data-testid="button-save-note"
              >
                {isSaving ? t("saving") : t("saveNote")}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="p-6 pb-3">
              <DialogHeader>
                <DialogTitle className="text-xl">{t("myNotes")}</DialogTitle>
              </DialogHeader>
            </div>

            <div className="flex items-center justify-between px-6 border-b border-border">
              <div className="flex items-center gap-2 pb-2 -mb-px border-b-2 border-primary text-sm font-medium">
                <StickyNote className="h-4 w-4" />
                <span className="uppercase tracking-wide">{t("myNotes")}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{notes.length}</Badge>
              </div>
              <button
                type="button"
                onClick={openAddView}
                className="inline-flex items-center gap-1.5 pb-2 text-sm font-medium text-primary hover:opacity-80 transition-opacity"
                data-testid="button-add-new-note"
              >
                <Plus className="h-4 w-4" />
                {t("addNewNote")}
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 max-h-[45vh] overflow-y-auto">
              {isLoading && <Skeleton className="h-20 w-full" />}

              {!isLoading && notes.length === 0 && (
                <div className="py-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <StickyNote className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("noNotesYet")}</p>
                  <Button variant="outline" size="sm" onClick={openAddView} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t("addNewNote")}
                  </Button>
                </div>
              )}

              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group relative rounded-lg border border-border/60 bg-card p-4"
                  data-testid={`note-${note.id}`}
                >
                  <div className="flex items-start gap-2.5 pr-16">
                    <ChevronsRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-2">
                      {note.selectedText && (
                        <p className="font-body text-[11px] text-muted-foreground/80 italic line-clamp-2">
                          {note.selectedText}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{note.content}</p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {verseLabel ? `${verseLabel} · ` : ""}{formatNoteDate(note.updatedAt || note.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => openEditView(note)}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(note.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 px-6 py-3.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p>{t("notesSecureTip")}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
