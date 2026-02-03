import { BookOpen, Globe, MessageSquareText, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VideoInline } from "@/components/video-popup";

const features = [
  {
    icon: BookOpen,
    title: "Ancient Wisdom",
    description: "Access sacred texts from Advaita, Jain, Hindu, Sanskrit, Telugu, and Tamil traditions",
  },
  {
    icon: Globe,
    title: "Multi-Script Support",
    description: "Read in Devanagari, Kannada, Telugu, Tamil, and more scripts",
  },
  {
    icon: MessageSquareText,
    title: "Scholarly Explanations",
    description: "Explore multiple commentaries from renowned scholars",
  },
  {
    icon: Sparkles,
    title: "Translation & Insight",
    description: "Translate any verse and gain deeper understanding",
  },
];

export function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl text-center space-y-6 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 mb-2 sm:mb-4">
            <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl font-semibold tracking-tight">
            Sacred Texts Library
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-md mx-auto">
            Explore the timeless wisdom of ancient scriptures with translations and scholarly explanations
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="p-5 text-left hover-elevate transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 sm:mt-8">
          <VideoInline 
            videoId="8ELHatzdtAk"
            title="Introduction to Sacred Texts"
            className="max-w-xl mx-auto shadow-lg"
          />
        </div>

        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Select a text from the sidebar to begin reading</span>
            <span className="sm:hidden">Tap the menu icon to browse texts</span>
          </p>
        </div>
      </div>
    </div>
  );
}
