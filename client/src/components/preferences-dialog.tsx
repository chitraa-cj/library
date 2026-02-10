import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Language } from "@shared/schema";
import type { User } from "@shared/models/auth";

interface PreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  currentLanguage: string | null;
  currentAuthor: string | null;
  onLanguageChange: (lang: string) => void;
  onAuthorChange: (author: string | null) => void;
}

export function PreferencesDialog({
  open,
  onOpenChange,
  user,
  currentLanguage,
  currentAuthor,
  onLanguageChange,
  onAuthorChange,
}: PreferencesDialogProps) {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState(currentLanguage || "english");
  const [author, setAuthor] = useState(currentAuthor || "");
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [saving, setSaving] = useState(false);

  const { data: allLanguages } = useQuery<Language[]>({
    queryKey: ["/api/languages"],
  });

  const { data: allAuthors } = useQuery<string[]>({
    queryKey: ["/api/authors"],
  });

  useEffect(() => {
    if (open) {
      setLanguage(currentLanguage || "english");
      setAuthor(currentAuthor || "");
      setSelectedTheme(theme);
    }
  }, [open, currentLanguage, currentAuthor, theme]);

  const handleSave = async () => {
    setSaving(true);
    try {
      setTheme(selectedTheme);

      onLanguageChange(language);
      onAuthorChange(author || null);

      await apiRequest("PATCH", "/api/user/preferences", {
        preferredLanguage: language,
        preferredAuthor: author || null,
        preferredTheme: selectedTheme,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" data-testid="dialog-preferences">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>
            Set your default reading preferences. These will be applied each time you open the app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pref-language">Translation Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="pref-language" data-testid="select-pref-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {allLanguages?.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} data-testid={`option-pref-lang-${lang.code}`}>
                    {lang.nativeName || lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pref-author">Preferred Commentator</Label>
            <Select value={author || "__none__"} onValueChange={(v) => setAuthor(v === "__none__" ? "" : v)}>
              <SelectTrigger id="pref-author" data-testid="select-pref-author">
                <SelectValue placeholder="Select commentator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" data-testid="option-pref-author-none">No preference</SelectItem>
                {allAuthors?.map((authorName) => (
                  <SelectItem key={authorName} value={authorName} data-testid={`option-pref-author-${authorName}`}>
                    {authorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Appearance</Label>
            <div className="flex gap-2">
              <Button
                variant={selectedTheme === "light" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setSelectedTheme("light")}
                data-testid="button-pref-theme-light"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={selectedTheme === "dark" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setSelectedTheme("dark")}
                data-testid="button-pref-theme-dark"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-pref-cancel">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-pref-save">
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
