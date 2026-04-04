'use client';

import {
  Box,
  Card,
  CardBody,
  Flex,
  HStack,
  Text,
  Badge,
  Button,
  Icon,
  IconButton,
  Divider,
} from '@chakra-ui/react';
import { FiExternalLink, FiMessageSquare, FiChevronDown, FiChevronRight, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getSourceColor, formatDate } from '@/lib/factUtils';
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
  onClickDetail: () => void;
  // 編集
  editingFactId: string | null;
  editForm: EditFormState;
  onEditFormChange: (form: EditFormState) => void;
  onStartEditing: (fact: Fact) => void;
  onSaveEdit: (factId: string, parentId?: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  // 削除
  onDelete: (fact: Fact) => void;
  // コメント
  commentText: string;
  onCommentChange: (value: string) => void;
  onSendComment: () => void;
  sendingComment: boolean;
  // マスターデータ
  categories: F2ACategory[];
  projects: F2AProject[];
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

  return (
    <Card
      bg="gray.800"
      borderColor="gray.700"
      borderWidth="1px"
      _hover={{ borderColor: 'gray.600' }}
      transition="all 0.2s"
      overflow="hidden"
    >
      <CardBody pb={grouped ? 0 : undefined}>
        {/* 親 Fact */}
        {editingFactId === fact.id ? (
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
          <Flex justify="space-between" align="flex-start">
            <HStack
              spacing={3}
              align="flex-start"
              flex={1}
              cursor="pointer"
              onClick={onClickDetail}
              _hover={{ opacity: 0.9 }}
            >
              <Box
                w={1}
                minH="50px"
                borderRadius="full"
                bg={`${getSourceColor(fact.source)}.500`}
                flexShrink={0}
              />
              <Box flex={1}>
                <Text fontWeight="semibold" fontSize="lg" mb={1}>
                  {fact.title}
                </Text>
                {fact.summary && (
                  <Text fontSize="sm" color="gray.400" mb={2}>
                    {fact.summary}
                  </Text>
                )}
                <HStack spacing={2} flexWrap="wrap">
                  <Badge
                    colorScheme={getSourceColor(fact.source)}
                    variant="subtle"
                  >
                    {fact.source}
                  </Badge>
                  <Badge colorScheme="gray" variant="outline">
                    {fact.type}
                  </Badge>
                  {fact.categoryId && (() => {
                    const cat = categories.find((c) => c.id === fact.categoryId);
                    return cat ? (
                      <Badge bg={cat.color} color="white" fontSize="xs">{cat.name}</Badge>
                    ) : null;
                  })()}
                  {fact.projectId && (() => {
                    const proj = projects.find((p) => p.id === fact.projectId);
                    return proj ? (
                      <Badge colorScheme="cyan" variant="subtle" fontSize="xs">{proj.title}</Badge>
                    ) : null;
                  })()}
                  <Text fontSize="xs" color="gray.500">
                    {formatRelativeTime(fact.occurredAt)} (
                    {formatDate(fact.occurredAt)})
                  </Text>
                </HStack>
              </Box>
            </HStack>

            <HStack spacing={1} flexShrink={0}>
              {(fact.source === 'manual' || fact.source === 'comment') && (
                <>
                  <IconButton
                    aria-label="編集"
                    icon={<FiEdit2 />}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => onStartEditing(fact)}
                  />
                  <IconButton
                    aria-label="削除"
                    icon={<FiTrash2 />}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
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
                  colorScheme="gray"
                  rightIcon={<Icon as={FiExternalLink} />}
                >
                  開く
                </Button>
              )}
            </HStack>
          </Flex>
        )}

        {/* スレッドバー */}
        {grouped && (
          <Box mt={3}>
            <Divider borderColor="gray.700" />
            <Flex
              align="center"
              py={2.5}
              px={2}
              mx={-2}
              mt={1}
              cursor="pointer"
              borderRadius="md"
              _hover={{ bg: 'gray.700' }}
              onClick={onToggleExpand}
              role="button"
              tabIndex={0}
            >
              <Icon
                as={FiMessageSquare}
                color={hasChildren ? 'brand.400' : 'gray.500'}
                boxSize={4}
                mr={2}
              />
              <Text fontSize="sm" color={hasChildren ? 'brand.400' : 'gray.500'} fontWeight="medium">
                {hasChildren ? `${childCount}件の関連イベント` : 'コメントを追加'}
              </Text>
              <Icon
                as={isExpanded ? FiChevronDown : FiChevronRight}
                color="gray.500"
                boxSize={4}
                ml={2}
              />
            </Flex>
          </Box>
        )}
      </CardBody>

      {/* スレッド展開 */}
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
          categories={categories}
          projects={projects}
        />
      )}
    </Card>
  );
}
