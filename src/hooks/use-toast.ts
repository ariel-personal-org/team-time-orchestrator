
import { toast as sonnerToast } from "sonner";

export { type ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  duration?: number;
};

const useToast = () => {
  const toast = (options: ToastOptions) => {
    const { title, description, variant, action, duration } = options;
    
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
        action,
        duration: duration ?? 5000,
      });
    } else {
      sonnerToast(title, {
        description,
        action,
        duration: duration ?? 5000,
      });
    }
  };

  return { toast };
};

const toast = (options: ToastOptions) => {
  const { title, description, variant, action, duration } = options;
  
  if (variant === "destructive") {
    sonnerToast.error(title, {
      description,
      action,
      duration: duration ?? 5000,
    });
  } else {
    sonnerToast(title, {
      description,
      action,
      duration: duration ?? 5000,
    });
  }
};

export { useToast, toast };
