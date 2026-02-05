import { BookOpen, Globe, MessageSquareText, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VideoInline } from "@/components/video-popup";

const features = [
  {
    icon: BookOpen,
    title: "Isha Upanishad",
    description: "Study the complete 18 mantras of the Isha Upanishad with original Sanskrit text",
  },
  {
    icon: Globe,
    title: "Multi-Script Support",
    description: "Read in Devanagari, Kannada, Telugu, Tamil, and English scripts",
  },
  {
    icon: MessageSquareText,
    title: "Shankaracharya Bhashya",
    description: "Complete commentary by Adi Shankaracharya explaining the profound Advaita wisdom",
  },
  {
    icon: Sparkles,
    title: "Translations & Insight",
    description: "Multiple translations by renowned scholars for deeper understanding",
  },
];

export function WelcomeScreen() {
  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-8 bg-gradient-to-b from-primary/10 via-background to-accent/20 relative overflow-y-auto">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center overflow-hidden">
        <span className="text-[40rem] font-serif text-primary">ॐ</span>
      </div>
      
      <div className="max-w-2xl text-center space-y-6 sm:space-y-8 relative z-10 py-8">
        <div className="space-y-3 sm:space-y-4">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full blur-xl"></div>
            <img 
              src="https://oneness.org.in/assets/img/favicon.png" 
              alt="Ekatma Dham"
              className="h-20 sm:h-24 w-20 sm:w-24 object-contain mx-auto relative"
            />
          </div>
          
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="text-2xl sm:text-3xl text-primary/60 font-serif">ॐ</span>
            <h1 className="font-serif text-2xl sm:text-4xl font-semibold tracking-tight text-primary">
              Ekatma Dham
            </h1>
            <span className="text-2xl sm:text-3xl text-primary/60 font-serif">ॐ</span>
          </div>
          
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground font-medium">
            Abode of Oneness
          </p>
          
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40"></div>
            <span className="text-primary/50 text-lg">✦</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40"></div>
          </div>
          
          <p className="text-sm sm:text-lg text-muted-foreground max-w-md mx-auto">
            Explore the Isha Upanishad with complete Shankaracharya Bhashya and multiple translations
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="p-5 text-left hover-elevate transition-all border-primary/10 bg-card/80 backdrop-blur-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shrink-0 border border-primary/20">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm text-foreground">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6 sm:mt-8 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-primary/30"></div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider" data-testid="heading-explanatory-videos">
              Watch Introduction
            </h2>
            <div className="h-px w-8 bg-primary/30"></div>
          </div>
          <VideoInline 
            videoId="8ELHatzdtAk"
            title="Introduction to Isha Upanishad"
            className="max-w-xl mx-auto rounded-xl overflow-hidden border border-primary/20"
          />
        </div>

        <div className="pt-4">
          <p className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Select a text from the sidebar to begin reading</span>
            <span className="sm:hidden">Tap the menu icon to browse texts</span>
          </p>
        </div>
        
        <div className="text-primary/30 text-xs tracking-widest">
          ॥ सर्वं खल्विदं ब्रह्म ॥
        </div>
      </div>
    </div>
  );
}
