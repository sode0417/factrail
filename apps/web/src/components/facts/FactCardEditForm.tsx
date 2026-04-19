'use client';

import {
  VStack,
  HStack,
  Input,
  Textarea,
  Select,
  IconButton,
} from '@chakra-ui/react';
import { FiCheck, FiX } from 'react-icons/fi';
import type { F2ACategory, F2AProject } from '@/types/fact';

export interface EditFormState {
  title: string;
  summary: string;
  projectId: string | null;
  categoryId: string | null;
}

interface FactCardEditFormProps {
  editForm: EditFormState;
  onEditFormChange: (form: EditFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  categories: F2ACategory[];
  projects: F2AProject[];
  size?: 'normal' | 'compact';
}

export function FactCardEditForm({
  editForm,
  onEditFormChange,
  onSave,
  onCancel,
  isSaving,
  categories,
  projects,
  size = 'normal',
}: FactCardEditFormProps) {
  const isCompact = size === 'compact';

  return (
    <VStack spacing={isCompact ? 2 : 3} align="stretch">
      <Input
        value={editForm.title}
        onChange={(e) => onEditFormChange({ ...editForm, title: e.target.value })}
        bg="bg.canvas"
        borderColor="border.muted"
        fontWeight={isCompact ? 'medium' : 'semibold'}
        fontSize={isCompact ? 'sm' : 'lg'}
        size={isCompact ? 'sm' : 'md'}
        placeholder="タイトル"
      />
      {!isCompact && (
        <>
          <Textarea
            value={editForm.summary}
            onChange={(e) => onEditFormChange({ ...editForm, summary: e.target.value })}
            bg="bg.canvas"
            borderColor="border.muted"
            fontSize="sm"
            placeholder="サマリー（任意）"
            rows={2}
            resize="none"
          />
          <HStack spacing={2}>
            <Select
              size="sm"
              maxW="180px"
              bg="bg.canvas"
              borderColor="border.muted"
              value={editForm.categoryId ?? ''}
              onChange={(e) => onEditFormChange({ ...editForm, categoryId: e.target.value || null })}
            >
              <option value="">カテゴリなし</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
            {projects.length > 0 && (
              <Select
                size="sm"
                maxW="220px"
                bg="bg.canvas"
                borderColor="border.muted"
                value={editForm.projectId ?? ''}
                onChange={(e) => onEditFormChange({ ...editForm, projectId: e.target.value || null })}
              >
                <option value="">プロジェクトなし</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                ))}
              </Select>
            )}
          </HStack>
        </>
      )}
      <HStack spacing={2}>
        <IconButton
          aria-label="保存"
          icon={<FiCheck />}
          bg="accent.default"
          color="white"
          _hover={{ bg: 'accent.strong' }}
          size={isCompact ? 'xs' : 'sm'}
          onClick={onSave}
          isLoading={isSaving}
          isDisabled={!editForm.title.trim()}
        />
        <IconButton
          aria-label="キャンセル"
          icon={<FiX />}
          variant="ghost"
          size={isCompact ? 'xs' : 'sm'}
          onClick={onCancel}
        />
      </HStack>
    </VStack>
  );
}
