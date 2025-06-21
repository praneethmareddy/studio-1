import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, User, Info, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
}

export default function ChatMessage({ message, isCurrentUser }: ChatMessageProps) {
  const getAvatarIcon = () => {
    switch (message.sender) {
      case 'ai': return <Sparkles className="h-5 w-5" />;
      case 'system': return <Info className="h-5 w-5" />;
      case 'user':
      default: return <User className="h-5 w-5" />;
    }
  };
  
  const getSenderName = () => {
    switch (message.sender) {
      case 'ai': return 'AI Assistant';
      case 'system': return 'System Notification';
      case 'user':
      default: return message.senderName || (isCurrentUser ? 'You' : 'Participant');
    }
  };

  const senderName = getSenderName();
  const avatarIcon = getAvatarIcon();

  const avatarBgColor = isCurrentUser 
    ? 'bg-gradient-to-br from-primary to-accent' 
    : message.sender === 'ai' 
    ? 'bg-gradient-to-br from-accent to-secondary'
    : 'bg-muted';
  
  const avatarFgColor = isCurrentUser || message.sender === 'ai' 
    ? 'text-primary-foreground'
    : 'text-muted-foreground';

  const messageBg = isCurrentUser
    ? 'bg-primary text-primary-foreground shadow-md'
    : message.sender === 'ai'
    ? 'bg-card border border-accent/50 shadow-sm'
    : 'bg-card border border-border/70 shadow-sm';
  
  const messageTextColor = isCurrentUser 
    ? 'text-primary-foreground' 
    : 'text-card-foreground';


  if (message.sender === 'system') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 p-2 my-2 rounded-lg text-xs animate-slide-in-up w-full text-center',
          'bg-muted/70 text-muted-foreground italic',
          'max-w-[90%] md:max-w-[80%] mx-auto'
        )}
        style={{ animationDelay: '0.05s' }}
      >
        <Info className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      </div>
    );
  }


  return (
    <div
      className={cn(
        'flex items-end gap-2 p-0 my-1.5 rounded-lg animate-slide-in-up',
        isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto flex-row',
        'max-w-[85%] md:max-w-[75%]',
        { 'self-end': isCurrentUser, 'self-start': !isCurrentUser }
      )}
      style={{ animationDelay: '0.05s' }}
    >
      <Avatar className={cn(
        "h-8 w-8 shrink-0 shadow-sm", 
        avatarBgColor,
        avatarFgColor
      )}>
        <AvatarFallback className="bg-transparent text-xs">{avatarIcon}</AvatarFallback>
      </Avatar>
      
      <div className={cn(
        "flex flex-col p-2.5 rounded-lg min-w-0 overflow-hidden",
        messageBg,
        isCurrentUser ? 'rounded-br-none' : 'rounded-bl-none'
      )}>
        <p className={cn(
          "font-semibold text-xs mb-0.5 break-words", 
           isCurrentUser ? 'text-primary-foreground/90' : 'text-foreground/90'
        )}>
          {senderName}
        </p>
        <p className={cn("whitespace-pre-wrap break-word text-sm", messageTextColor)}>
          {message.text}
        </p>
        <p className={cn(
            "text-[10px] mt-1.5", 
            isCurrentUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/80 text-left'
          )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
