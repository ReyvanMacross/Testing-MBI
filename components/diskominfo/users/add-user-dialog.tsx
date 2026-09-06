"use client";

import type { OpdOption, WilayahOption } from "@/lib/diskominfo/users";

import { UserForm } from "./user-form";

type AddUserDialogProps = {
  open: boolean;
  opdOptions: OpdOption[];
  wilayahOptions: WilayahOption[];
  onClose: () => void;
  onSuccess: () => void;
};

export function AddUserDialog({
  open,
  opdOptions,
  wilayahOptions,
  onClose,
  onSuccess,
}: AddUserDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <UserForm
      mode="add"
      opdOptions={opdOptions}
      wilayahOptions={wilayahOptions}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
