import type { Metadata } from 'next';
import { Box, Container, Heading, Text, VStack, UnorderedList, ListItem, Link } from '@chakra-ui/react';

export const metadata: Metadata = {
  title: '利用規約 | Factrail',
  description: 'Factrail の利用規約',
};

// 最終更新日: 内容を変更したときは必ず更新する
const LAST_UPDATED = '2026年9月2日';

export default function TermsPage() {
  return (
    <Box bg="bg.canvas" minH="100vh" py={{ base: 8, md: 16 }}>
      <Container maxW="3xl">
        <VStack spacing={8} align="stretch">
          <VStack spacing={2} align="stretch">
            <Heading as="h1" size="lg" color="text.default">
              利用規約
            </Heading>
            <Text fontSize="sm" color="text.muted">
              最終更新日: {LAST_UPDATED}
            </Text>
          </VStack>

          <Section title="1. 本規約について">
            <Text>
              本規約は、袖山直人（個人）が開発・運営する Factrail（以下「本サービス」）の利用条件を定めるものです。
              本サービスを利用する場合、本規約に同意したものとみなします。
            </Text>
          </Section>

          <Section title="2. 本サービスの位置づけ">
            <Text>
              本サービスは、運営者が自身の活動記録を集めて振り返ることを目的に個人で開発・運営している
              ツールです。法人による運営ではなく、商用サービスとして第三者に提供しているものではありません。
              個人の裁量で運用しているため、予告なく仕様の変更・機能の追加や削除・提供の停止を行うことがあります。
            </Text>
          </Section>

          <Section title="3. 禁止事項">
            <Text mb={3}>本サービスの利用にあたり、以下の行為を禁止します。</Text>
            <UnorderedList spacing={2}>
              <ListItem>法令または公序良俗に違反する行為</ListItem>
              <ListItem>他の利用者や第三者の権利を侵害する行為</ListItem>
              <ListItem>本サービスの運営を妨害する行為、または不正にアクセスを試みる行為</ListItem>
              <ListItem>権限を持たないアカウント・データへアクセスする行為</ListItem>
            </UnorderedList>
          </Section>

          <Section title="4. 免責事項">
            <UnorderedList spacing={2}>
              <ListItem>
                本サービスは<Text as="span" fontWeight="500">現状有姿で提供され、明示・黙示を問わず一切の保証を行いません</Text>
                。可用性・正確性・完全性・特定目的への適合性について保証しません。
              </ListItem>
              <ListItem>
                個人が運営しているため、障害対応やデータ復旧の義務を負いません。データのバックアップは
                利用者の責任で行ってください。
              </ListItem>
              <ListItem>
                本サービスの利用または利用不能によって生じた損害について、運営者は責任を負いません。
              </ListItem>
              <ListItem>
                本サービスが連携する外部サービス（GitHub・Slack・Google 等）の仕様変更・障害によって
                生じた不具合についても、運営者は責任を負いません。
              </ListItem>
            </UnorderedList>
          </Section>

          <Section title="5. 個人情報の取り扱い">
            <Text>
              本サービスにおける情報の取り扱いについては、
              <Link href="/privacy" color="accent.default" textDecoration="underline">
                プライバシーポリシー
              </Link>
              をご確認ください。
            </Text>
          </Section>

          <Section title="6. 本規約の変更">
            <Text>
              本規約の内容は必要に応じて変更することがあります。変更した場合は、本ページの最終更新日を
              更新します。
            </Text>
          </Section>

          <Section title="7. お問い合わせ">
            <Text>
              運営者: 袖山直人（個人）
              <br />
              連絡先:{' '}
              <Link href="mailto:sodeyama0417@gmail.com" color="accent.default" textDecoration="underline">
                sodeyama0417@gmail.com
              </Link>
            </Text>
          </Section>

          <Box pt={4} borderTopWidth="1px" borderColor="border.muted">
            <Link href="/privacy" color="accent.default" fontSize="sm" textDecoration="underline">
              プライバシーポリシー
            </Link>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

/** 見出し + 本文のひとまとまりを表すセクション */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box as="section">
      <Heading as="h2" size="sm" mb={3} color="text.default">
        {title}
      </Heading>
      <Box color="text.default" fontSize="sm" lineHeight="1.9">
        {children}
      </Box>
    </Box>
  );
}
