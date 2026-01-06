function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // Base layout
        'inline-flex h-auto w-full items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground',
        
        // 1. Force everything to stay in one line (no wrapping)
        'flex-nowrap',
        
        // 2. Allow horizontal scrolling
        'overflow-x-auto',
        
        // 3. Hide the ugly scrollbar but keep scroll functionality
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base styles
        'inline-flex items-center justify-center',
        'rounded-md px-3 py-2 text-sm font-medium',
        
        // ✅ THE FIX: Prevent the button from being squashed
        'flex-shrink-0',
        
        // Keep text readable
        'whitespace-nowrap',
        
        // Standard colors
        'text-foreground dark:text-muted-foreground',
        'data-[state=active]:bg-background data-[state=active]:text-foreground',
        'data-[state=active]:shadow-sm',

        // Focus & Disabled states
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',

        className,
      )}
      {...props}
    />
  )
}
