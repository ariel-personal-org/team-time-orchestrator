
import * as React from "react"

export type ToastProps = {
  id?: string
  className?: string
  variant?: "default" | "destructive"
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  actionAltText?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onDismiss?: () => void
}

export type ToastActionElement = React.ReactElement<{
  className?: string
  altText?: string
  onClick?: () => void
}>
