import type { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, Info } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isCurrentUser: boolean;
}

export default function ChatMessage({ message, isCurrentUser }: ChatMessageProps) {
  const getAvatarIcon = () => {
    switch (message.sender) {
      case 'ai': return <Bot className="h-5 w-5" />;
      case 'system': return <Info className="h-5 w-5" />;
      case 'user':
      default: return <User className="h-5 w-5" />;
    }
  };
  
  const getSenderName = () => {
    switch (message.sender) {
      case 'ai': return 'AI Assistant';
      case 'system': return 'System';
      case 'user':
      default: return isCurrentUser ? 'You' : 'Participant';
    }
  };

  const senderName = getSenderName();
  const avatarIcon = getAvatarIcon();

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 my-2 rounded-lg shadow-sm animate-slide-in-up',
        isCurrentUser ? 'ml-auto bg-primary text-primary-foreground' : 'bg-card text-card-foreground border',
        message.sender === 'ai' && 'bg-accent/20 border-accent', // Lighter accent for AI
        message.sender === 'system' && 'bg-muted text-muted-foreground text-sm italic text-center w-full justify-center',
        'max-w-[85%] md:max-w-[75%]', // Responsive max width
        { 'self-end': isCurrentUser, 'self-start': !isCurrentUser },
        message.sender === 'system' ? 'mx-auto' : ''
      )}
      style={{ animationDelay: '0.05s' }} // Subtle animation delay
    >
      {message.sender !== 'system' && (
        <Avatar className={cn(
          "h-8 w-8 shrink-0", 
          isCurrentUser ? 'bg-primary-foreground text-primary' : 'bg-secondary text-secondary-foreground'
        )}>
          <AvatarFallback>{avatarIcon}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex-1", message.sender === 'system' ? 'text-center' : '')}>
        {message.sender !== 'system' && (
          <p className={cn(
            "font-semibold text-sm", 
            isCurrentUser ? 'text-primary-foreground/90' : 'text-foreground/90'
          )}>
            {senderName}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p className={cn(
            "text-xs mt-1", 
            isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground/80',
            message.sender === 'system' ? 'text-center' : 'text-left'
          )}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
