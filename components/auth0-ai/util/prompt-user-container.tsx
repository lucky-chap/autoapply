import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LogIn } from "lucide-react"

export interface PromptUserContainerProps {
  title: React.ReactNode
  description?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
    className?: string
  }
  icon?: React.ReactNode
  readOnly?: boolean
  containerClassName?: string
}

export function PromptUserContainer({
  title,
  description,
  action,
  icon,
  readOnly = false,
  containerClassName,
}: PromptUserContainerProps) {
  return (
    <fieldset
      className={cn(
        "border border-zinc-700 rounded-lg items-center w-full justify-between p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-2 bg-zinc-900",
        { "disabled cursor-not-allowed": readOnly },
        containerClassName
      )}
      disabled={readOnly}
    >
      <div className="w-full flex flex-col sm:flex-row justify-start items-center gap-4">
        {icon}
        <div className="flex flex-col gap-1 sm:gap-1.5 items-start w-full">
          <h2 className="grow text-sm sm:text-base leading-6 font-semibold text-white">
            {title}
          </h2>
          {description && (
            <p className="grow text-xs sm:text-sm leading-5 font-light text-zinc-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="w-full sm:w-fit">
          <Button variant="default" size="default" onClick={action.onClick}>
            <LogIn className="w-4 h-4 mr-2" />
            <span>{action.label}</span>
          </Button>
        </div>
      )}
    </fieldset>
  )
}
