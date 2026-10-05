import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Play } from "lucide-react";
import { youTubeEmbedUrl, youTubeThumbnailUrl } from "@shared/video-resource";

interface VideoPopupProps {
  videoId?: string;
  title?: string;
  triggerClassName?: string;
  buttonLabel?: string;
  /** Where to begin playback, for a talk that covers a whole chapter. */
  startSeconds?: number;
  /** Screen-reader description; defaults to the title. */
  description?: string;
}

export function VideoPopup({ 
  videoId = "8ELHatzdtAk",
  title = "Introduction Video",
  triggerClassName = "",
  buttonLabel = "Watch Video",
  startSeconds = 0,
  description,
}: VideoPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={triggerClassName}
          data-testid="button-video-popup"
        >
          <Play className="h-4 w-4 mr-2" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-body">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description ?? title}</DialogDescription>
        </DialogHeader>
        <div className="relative w-full aspect-video">
          <iframe
            src={youTubeEmbedUrl({ videoId, startSeconds }, { autoplay: true })}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VideoInlineProps {
  videoId?: string;
  title?: string;
  className?: string;
  startSeconds?: number;
}

export function VideoInline({ 
  videoId = "8ELHatzdtAk",
  title = "Introduction Video",
  className = "",
  startSeconds = 0,
}: VideoInlineProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPlaying(true);
    }
  };

  if (!isPlaying) {
    return (
      <div 
        className={`relative w-full aspect-video bg-muted rounded-md overflow-hidden cursor-pointer ${className}`}
        onClick={() => setIsPlaying(true)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Play video: ${title}`}
        data-testid="button-video-inline"
      >
        <img 
          src={youTubeThumbnailUrl({ videoId }, "maxres")}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            // maxres doesn't exist for every upload; hq always does.
            (e.target as HTMLImageElement).src = youTubeThumbnailUrl({ videoId }, "hq");
          }}
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="h-8 w-8 text-foreground ml-1" />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white font-medium text-sm" data-testid="text-video-title">{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-md overflow-hidden ${className}`}>
      <iframe
        src={youTubeEmbedUrl({ videoId, startSeconds }, { autoplay: true })}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
