'use client';

import {
  Box,
  Card,
  CardBody,
  VStack,
  HStack,
  Text,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';

export default function ActivityPage() {
  return (
    <MainLayout title="アクティビティ" subtitle="システムのアクティビティログ">
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
        <CardBody>
          <Flex justify="center" align="center" py={10}>
            <VStack spacing={4}>
              <Text fontSize="lg" color="gray.400">
                アクティビティログ機能
              </Text>
              <Badge colorScheme="yellow" fontSize="sm">
                Coming Soon
              </Badge>
              <Text fontSize="sm" color="gray.500" textAlign="center">
                Webhook受信やSlack投稿などの<br />
                システムアクティビティをここに表示予定
              </Text>
            </VStack>
          </Flex>
        </CardBody>
      </Card>
    </MainLayout>
  );
}
