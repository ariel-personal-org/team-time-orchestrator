
import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkPeriod } from "@/components/WorkPeriodList";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EditWorkPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workPeriod: WorkPeriod;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  start_date: z.date({ required_error: "Start date is required" }),
  end_date: z.date({ required_error: "End date is required" }),
  needed_capacity: z.coerce
    .number()
    .int()
    .min(1, "Capacity must be at least 1"),
});

const EditWorkPeriodDialog: React.FC<EditWorkPeriodDialogProps> = ({
  open,
  onOpenChange,
  workPeriod,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize form with work period data
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: workPeriod.name,
      start_date: new Date(workPeriod.start_date),
      end_date: new Date(workPeriod.end_date),
      needed_capacity: workPeriod.needed_capacity,
    },
  });

  // Update work period mutation
  const updateWorkPeriod = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase
        .from("work_periods")
        .update({
          name: values.name,
          start_date: values.start_date.toISOString(),
          end_date: values.end_date.toISOString(),
          needed_capacity: values.needed_capacity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workPeriod.id)
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      // Invalidate and refetch work period queries
      queryClient.invalidateQueries({ queryKey: ["workPeriod", workPeriod.id] });
      queryClient.invalidateQueries({ queryKey: ["workPeriods"] });
      
      toast({
        title: "Work Period Updated",
        description: "The work period has been successfully updated.",
      });
      
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error Updating Work Period",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit handler
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (values.start_date > values.end_date) {
      form.setError("end_date", {
        type: "manual",
        message: "End date must be after start date",
      });
      return;
    }

    updateWorkPeriod.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Work Period</DialogTitle>
          <DialogDescription>
            Update the details of the work period.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="needed_capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Needed Capacity (users per shift)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Enter capacity"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditWorkPeriodDialog;
