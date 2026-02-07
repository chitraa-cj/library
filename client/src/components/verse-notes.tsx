import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Plus, Check, X, Pencil, Trash2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import type { Note } from "@shared/schema";

interface VerseNotesProps {
  verseId: string;
  pendingSelectedText?: string | null;
  onSelectedTextConsumed?: () => void;
}

export function VerseNotes({ verseId, pendingSelectedText, onSelectedTextConsumed }: VerseNotesProps) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [noteSelectedText, setNoteSelectedText] = useState<string | null>(null);

  const { data: verseNotes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/verses", verseId, "notes"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (pendingSelectedText && !addingNote) {
      setAddingNote(true);
      setNoteSelectedText(pendingSelectedText);
      onSelectedTextConsumed?.();
    }
  }, [pendingSelectedText]);

  const createMutation = useMutation({
    mutationFn: async ({ content, selectedText }: { content: string; selectedText?: string | null }) => {
      const res = await apiRequest("POST", `/api/verses/${verseId}/notes`, { content, selectedText: selectedText || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      setNewNote("");
      setAddingNote(false);
      setNoteSelectedText(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
      setEditingId(null);
      setEditContent("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verses", verseId, "notes"] });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <StickyNote className="h-3 w-3" />
          My Notes
        </h3>
        <button
          onClick={() => { window.location.href = "/auth"; }}
          className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-2 rounded-md border border-border/50 hover:border-primary/30 bg-background/60"
          data-testid="button-login-for-notes"
        >
          <StickyNote className="h-4 w-4" />
          <span>Log in to add notes</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="notes-section">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <StickyNote className="h-3 w-3" />
          My Notes
          {verseNotes.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{verseNotes.length}</Badge>
          )}
        </h3>
        {!addingNote && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddingNote(true)}
            className="h-7 text-xs gap-1"
            data-testid="button-add-note"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {addingNote && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-150" data-testid="new-note-form">
          {noteSelectedText && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/15 text-xs">
              <Quote className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <p className="font-serif text-muted-foreground line-clamp-3 italic" data-testid="text-selected-quote">{noteSelectedText}</p>
            </div>
          )}
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write your note..."
            className="text-sm min-h-[70px] bg-background/80 border-primary/20 resize-none"
            data-testid="input-new-note"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setAddingNote(false); setNewNote(""); setNoteSelectedText(null); }}
              className="h-7 text-xs"
              data-testid="button-cancel-note"
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ content: newNote, selectedText: noteSelectedText })}
              disabled={!newNote.trim() || createMutation.isPending}
              className="h-7 text-xs"
              data-testid="button-save-note"
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading && <Skeleton className="h-16 w-full" />}

      {verseNotes.length > 0 && (
        <div className="space-y-2">
          {verseNotes.map((note) => (
            <div
              key={note.id}
              className="group relative rounded-md border border-border/40 bg-background/60 p-3"
              data-testid={`note-${note.id}`}
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="text-sm min-h-[60px] bg-background/80 border-primary/20 resize-none"
                    data-testid="input-edit-note"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      className="h-7 text-xs"
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: note.id, content: editContent })}
                      disabled={!editContent.trim() || updateMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="button-save-edit"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {note.selectedText && (
                    <div className="flex items-start gap-1.5 mb-2 text-[11px]">
                      <Quote className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                      <p className="font-serif text-muted-foreground/80 italic line-clamp-2">{note.selectedText}</p>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap pr-14">{note.content}</p>
                  <div className="absolute top-2 right-2 flex items-center gap-1 invisible group-hover:visible">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      data-testid={`button-edit-note-${note.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => deleteMutation.mutate(note.id)}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ""}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && verseNotes.length === 0 && !addingNote && (
        <p className="text-xs text-muted-foreground/60 italic">No notes yet for this verse</p>
      )}
    </div>
  );
}
