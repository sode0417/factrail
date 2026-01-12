'use client';

import {
  Box,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Icon,
  Flex,
  Text,
  VStack,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { MainLayout } from '@/components/layout';
import { FiDatabase, FiGithub, FiMessageSquare, FiActivity } from 'react-icons/fi';
import { IconType } from 'react-icons';

interface StatCardProps {
  label: string;
  value: string;
  helpText: string;
  icon: IconType;
  color: string;
}

function StatCard({ label, value, helpText, icon, color }: StatCardProps) {
  return (
    <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
      <CardBody>
        <Flex justify="space-between" align="flex-start">
          <Stat>
            <StatLabel color="gray.400" fontSize="sm">
              {label}
            </StatLabel>
            <StatNumber fontSize="3xl" fontFamily="heading" mt={2}>
              {value}
            </StatNumber>
            <StatHelpText color="gray.500" fontSize="xs" mt={1}>
              {helpText}
            </StatHelpText>
          </Stat>
          <Box p={3} borderRadius="lg" bg={`${color}.900`}>
            <Icon as={icon} boxSize={6} color={`${color}.400`} />
          </Box>
        </Flex>
      </CardBody>
    </Card>
  );
}

interface RecentActivityItem {
  id: string;
  title: string;
  source: string;
  type: string;
  time: string;
}

const mockRecentActivity: RecentActivityItem[] = [
  {
    id: '1',
    title: 'API動作確認テスト',
    source: 'manual',
    type: 'note',
    time: '2分前',
  },
  {
    id: '2',
    title: 'Supabase → Prisma Studio 接続テスト',
    source: 'supabase-manual',
    type: 'test.supabase_created',
    time: '8日前',
  },
];

function getSourceColor(source: string): string {
  switch (source) {
    case 'github':
      return 'purple';
    case 'slack':
      return 'green';
    case 'manual':
      return 'blue';
    default:
      return 'gray';
  }
}

export default function DashboardPage() {
  return (
    <MainLayout title="ダッシュボード" subtitle="Factrailの概要を確認">
      {/* Stats Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        <StatCard
          label="総Facts数"
          value="2"
          helpText="過去30日間で+2"
          icon={FiDatabase}
          color="brand"
        />
        <StatCard
          label="GitHub連携"
          value="未接続"
          helpText="設定が必要です"
          icon={FiGithub}
          color="purple"
        />
        <StatCard
          label="Slack連携"
          value="未接続"
          helpText="設定が必要です"
          icon={FiMessageSquare}
          color="green"
        />
        <StatCard
          label="今日のアクティビティ"
          value="1"
          helpText="直近24時間"
          icon={FiActivity}
          color="accent"
        />
      </SimpleGrid>

      {/* Recent Activity */}
      <Card bg="gray.800" borderColor="gray.700" borderWidth="1px">
        <CardBody>
          <Text fontSize="lg" fontWeight="semibold" mb={4}>
            最近のアクティビティ
          </Text>
          <VStack spacing={4} align="stretch">
            {mockRecentActivity.map((item) => (
              <Flex
                key={item.id}
                p={4}
                bg="gray.900"
                borderRadius="lg"
                justify="space-between"
                align="center"
              >
                <HStack spacing={4}>
                  <Box
                    w={2}
                    h={10}
                    borderRadius="full"
                    bg={`${getSourceColor(item.source)}.500`}
                  />
                  <Box>
                    <Text fontWeight="medium">{item.title}</Text>
                    <HStack spacing={2} mt={1}>
                      <Badge
                        colorScheme={getSourceColor(item.source)}
                        variant="subtle"
                        fontSize="xs"
                      >
                        {item.source}
                      </Badge>
                      <Text fontSize="xs" color="gray.500">
                        {item.type}
                      </Text>
                    </HStack>
                  </Box>
                </HStack>
                <Text fontSize="sm" color="gray.500">
                  {item.time}
                </Text>
              </Flex>
            ))}
          </VStack>
        </CardBody>
      </Card>
    </MainLayout>
  );
}
