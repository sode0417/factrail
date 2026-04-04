'use client';

import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Icon,
  IconButton,
  Input,
  Spinner,
} from '@chakra-ui/react';
import { FiExternalLink, FiEdit2, FiTrash2, FiSend } from 'react-icons/fi';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { getSourceColor } from '@/lib/factUtils';
import { FactCardEditForm } from './FactCardEditForm';
import type { Fact, F2ACategory, F2AProject } from '@/types/fact';
import type { EditFormState } from './FactCardEditForm';

interface FactThreadProps {
  parentId: string;
  childFacts: Fact[] | undefined;
  loading: boolean;
  commentText: string;
  onCommentChange: (value: string) => void;
  onSendComment: () => void;
  sendingComment: boolean;
  editingFactId: string | null;
  editForm: EditFormState;
  onEditFormChange: (form: EditFormState) => void;
  onStartEditing: (fact: Fact) => void;
  onSaveEdit: (factId: string, parentId: string) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  onDelete: (fact: Fact) => void;
  categories: F2ACategory[];
  projects: F2AProject[];
}

export function FactThread({
  parentId,
  childFacts,
  loading,
  commentText,
  onCommentChange,
  onSendComment,
  sendingComment,
  editingFactId,
  editForm,
  onEditFormChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  isSaving,
  onDelete,
  categories,
  projects,
}: FactThreadProps) {
  return (
    <Box bg="gray.850" borderTop="1px" borderColor="gray.700">
      {loading && !childFacts ? (
        <Flex justify="center" py={4}>
          <Spinner size="sm" color="gray.500" />
        </Flex>
      ) : (
        <VStack spacing={0} align="stretch" px={5} py={3}>
          {childFacts && childFacts.map((child, idx) => (
            <Flex key={child.id} align="stretch">
              {/* タイムライン縦線 + ドット */}
              <Flex direction="column" align="center" mr={3} flexShrink={0}>
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg={`${getSourceColor(child.source)}.500`}
                  mt="6px"
                  flexShrink={0}
                />
                {idx < childFacts.length - 1 && (
                  <Box
                    w="2px"
                    flex={1}
                    bg="gray.600"
                    mt={1}
                  />
                )}
              </Flex>

              {/* 子 Fact 内容 */}
              <Box flex={1} pb={idx < childFacts.length - 1 ? 3 : 0}>
                {editingFactId === child.id ? (
                  <FactCardEditForm
                    editForm={editForm}
                    onEditFormChange={onEditFormChange}
                    onSave={() => onSaveEdit(child.id, parentId)}
                    onCancel={onCancelEdit}
                    isSaving={isSaving}
                    categories={categories}
                    projects={projects}
                    size="compact"
                  />
                ) : (
                  <Flex justify="space-between" align="flex-start">
                    <Box flex={1}>
                      <Text fontWeight="medium" fontSize="sm" color="gray.200">
                        {child.title}
                      </Text>
                      <HStack spacing={2} mt={1} flexWrap="wrap">
                        <Badge colorScheme="gray" variant="outline" fontSize="xs">
                          {child.type}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">
                          {formatRelativeTime(child.occurredAt)}
                        </Text>
                      </HStack>
                    </Box>
                    <HStack spacing={0} flexShrink={0} ml={2}>
                      {(child.source === 'manual' || child.source === 'comment') && (
                        <>
                          <IconButton
                            aria-label="編集"
                            icon={<FiEdit2 />}
                            size="xs"
                            variant="ghost"
                            colorScheme="gray"
                            onClick={() => onStartEditing(child)}
                          />
                          <IconButton
                            aria-label="削除"
                            icon={<FiTrash2 />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => onDelete(child)}
                          />
                        </>
                      )}
                      {child.sourceUrl && (
                        <Button
                          as="a"
                          href={child.sourceUrl}
                          target="_blank"
                          size="xs"
                          variant="ghost"
                          colorScheme="gray"
                          rightIcon={<Icon as={FiExternalLink} boxSize={3} />}
                        >
                          開く
                        </Button>
                      )}
                    </HStack>
                  </Flex>
                )}
              </Box>
            </Flex>
          ))}

          {/* コメント入力 */}
          <Flex mt={childFacts && childFacts.length > 0 ? 3 : 0} gap={2} align="flex-end">
            <Input
              placeholder="コメントを入力..."
              bg="gray.900"
              borderColor="gray.700"
              _placeholder={{ color: 'gray.500' }}
              _focus={{ borderColor: 'brand.500', boxShadow: 'none' }}
              size="sm"
              value={commentText}
              onChange={(e) => onCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onSendComment();
                }
              }}
            />
            <IconButton
              aria-label="コメントを送信"
              icon={<FiSend />}
              colorScheme="brand"
              size="sm"
              onClick={onSendComment}
              isLoading={sendingComment}
              isDisabled={!commentText.trim()}
            />
          </Flex>
        </VStack>
      )}
    </Box>
  );
}
