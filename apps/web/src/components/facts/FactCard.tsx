'use client';

import {
  Box,
  Flex,
  HStack,
  Text,
  Button,
  Icon,
  IconButton,
  Divider,
} from '@chakra-ui/react';
import {
  FiExternalLink,
  FiMessageSquare,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiTrash2,
} from 'react-icons/fi';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import {
  getSourceLabel,
  getSourceTagColors,
  formatDate,
  stripMarkdown,
} from '@/lib/factUtils';
import { FactCardEditForm } from './FactCardEditForm';
import { FactThread } from './FactThread';
import type { Fact, F2ACategory, F2AProject } from '@/types/fact';
import type { EditFormState } from './FactCardEditForm';

interface FactCardProps {
  fact: Fact;
  grouped: boolean;
  isExpanded: boolean;
  childFacts: Fact[] | undefined;
  childrenLoading: boolean;
  onToggleExpand: () => void;
  onClickDetail: (fact: Fact) => void;
  editingFactId: string | null;
  editForm: EditFormState;
  onEditFormChange: (form: EditFormState) => void;
  onStartEditing: (fact: Fact) => void;
  onSaveEdit: (factId: string, parentId?: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  onDelete: (fact: Fact) => void;
  commentText: string;
  onCommentChange: (value: string) => void;
  onSendComment: () => void;
  sendingComment: boolean;
  categories: F2ACategory[];
  projects: F2AProject[];
}

function SourceTag({ source }: { source: string }) {
  const { bg, color } = getSourceTagColors(source);
  return (
    <Box
      as="span"
      display="inline-block"
      bg={bg}
      color={color}
      fontSize="11.5px"
      fontWeight={500}
      px="10px"
      py="3px"
      borderRadius="sm"
      lineHeight="1.3"
    >
      {getSourceLabel(source)}
    </Box>
  );
}

function ChipBase({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      as="span"
      display="inline-block"
      bg={bg}
      color={color}
      fontSize="11.5px"
      fontWeight={500}
      px="10px"
      py="3px"
      borderRadius="sm"
      lineHeight="1.3"
    >
      {children}
    </Box>
  );
}

export function FactCard({
  fact,
  grouped,
  isExpanded,
  childFacts,
  childrenLoading,
  onToggleExpand,
  onClickDetail,
  editingFactId,
  editForm,
  onEditFormChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  onDelete,
  commentText,
  onCommentChange,
  onSendComment,
  sendingComment,
  categories,
  projects,
}: FactCardProps) {
  const childCount = fact.childCount ?? 0;
  const hasChildren = grouped && childCount > 0;
  const isEditing = editingFactId === fact.id;

  const category = fact.categoryId
    ? categories.find((c) => c.id === fact.categoryId)
    : null;
  const project = fact.projectId
    ? projects.find((p) => p.id === fact.projectId)
    : null;

  return (
    <Box
      position="relative"
      bg="bg.surface"
      border="1px solid"
      borderColor="border.muted"
      borderRadius="md"
      px={{ base: 4, md: 6 }}
      py={4}
      boxShadow="0 1px 2px rgba(74,60,20,0.04)"
      transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
      cursor={isEditing ? 'default' : 'pointer'}
      _hover={
        isEditing
          ? undefined
          : {
              transform: 'translateY(-2px)',
              boxShadow:
                '0 2px 6px rgba(74,60,20,0.08), 0 14px 30px rgba(74,60,20,0.17)',
              borderColor: 'accent.soft',
            }
      }
      overflow="hidden"
    >
      {/* Left accent bar */}
      <Box
        position="absolute"
        left={0}
        top={3}
        bottom={3}
        w="3px"
        bg="accent.default"
        borderRadius="full"
      />

      {isEditing ? (
        <FactCardEditForm
          editForm={editForm}
          onEditFormChange={onEditFormChange}
          onSave={() => onSaveEdit(fact.id)}
          onCancel={onCancelEdit}
          isSaving={isSaving}
          categories={categories}
          projects={projects}
        />
      ) : (
        <Flex
          justify="space-between"
          align="flex-start"
          gap={3}
          onClick={() => onClickDetail(fact)}
        >
          <Box flex={1} minW={0}>
            {/* Title + inline time */}
            <Flex align="baseline" gap={3} wrap="wrap" mb={fact.summary ? 1 : 2}>
              <Text
                fontWeight={600}
                fontSize="md"
                color="text.default"
                noOfLines={2}
              >
                {fact.title}
              </Text>
              <Text fontSize="12px" color="text.muted" flexShrink={0}>
                {new Date(fact.occurredAt).toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                <Text
                  as="span"
                  ml={2}
                  fontSize="11.5px"
                  color="text.muted"
                  opacity={0.8}
                >
                  · {formatRelativeTime(fact.occurredAt)}
                </Text>
              </Text>
            </Flex>

            {fact.summary && (
              <Text
                fontSize="sm"
                color="text.muted"
                mb={3}
                noOfLines={2}
                title={formatDate(fact.occurredAt)}
              >
                {stripMarkdown(fact.summary)}
              </Text>
            )}

            {/* Chips */}
            <HStack spacing={2} flexWrap="wrap">
              <SourceTag source={fact.source} />
              {category && (
                <ChipBase bg={category.color || '#E4DFD1'} color="white">
                  {category.name}
                </ChipBase>
              )}
              {project && (
                <ChipBase bg="#D6E0E8" color="#1F3A52">
                  {project.title}
                </ChipBase>
              )}
            </HStack>
          </Box>

          {/* Actions */}
          <HStack
            spacing={1}
            flexShrink={0}
            onClick={(e) => e.stopPropagation()}
          >
            {(fact.source === 'manual' || fact.source === 'comment') && (
              <>
                <IconButton
                  aria-label="編集"
                  icon={<FiEdit2 />}
                  size="sm"
                  variant="ghost"
                  color="text.muted"
                  _hover={{ bg: 'accent.soft', color: 'accent.strong' }}
                  onClick={() => onStartEditing(fact)}
                />
                <IconButton
                  aria-label="削除"
                  icon={<FiTrash2 />}
                  size="sm"
                  variant="ghost"
                  color="text.muted"
                  _hover={{ bg: '#F4D7D3', color: '#7A2F26' }}
                  onClick={() => onDelete(fact)}
                />
              </>
            )}
            {fact.sourceUrl && (
              <Button
                as="a"
                href={fact.sourceUrl}
                target="_blank"
                size="sm"
                variant="ghost"
                color="accent.strong"
                bg="accent.soft"
                borderRadius="pill"
                fontSize="12.5px"
                fontWeight={600}
                rightIcon={<Icon as={FiExternalLink} boxSize={3} />}
                _hover={{ bg: 'accent.default', color: 'white' }}
              >
                開く
              </Button>
            )}
          </HStack>
        </Flex>
      )}

      {/* Thread bar (grouped mode) */}
      {grouped && !isEditing && (
        <Box mt={3} onClick={(e) => e.stopPropagation()}>
          <Divider borderColor="border.muted" />
          <Flex
            align="center"
            py="10px"
            cursor="pointer"
            onClick={onToggleExpand}
            color={hasChildren ? 'accent.strong' : 'text.muted'}
            _hover={{ color: 'accent.default' }}
          >
            <Icon as={FiMessageSquare} boxSize={3.5} mr={2} />
            <Text fontSize="13px" fontWeight={500}>
              {hasChildren
                ? `${childCount} 件の関連イベント`
                : 'コメントを追加'}
            </Text>
            <Icon
              as={isExpanded ? FiChevronDown : FiChevronRight}
              boxSize={3.5}
              ml={2}
            />
          </Flex>
        </Box>
      )}

      {/* Thread expanded */}
      {grouped && isExpanded && (
        <FactThread
          parentId={fact.id}
          childFacts={childFacts}
          loading={childrenLoading}
          commentText={commentText}
          onCommentChange={onCommentChange}
          onSendComment={onSendComment}
          sendingComment={sendingComment}
          editingFactId={editingFactId}
          editForm={editForm}
          onEditFormChange={onEditFormChange}
          onStartEditing={onStartEditing}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          isSaving={isSaving}
          onDelete={onDelete}
          onClickDetail={onClickDetail}
          categories={categories}
          projects={projects}
        />
      )}
    </Box>
  );
}
