import type { Metadata } from 'next';
import { Box, Container, Heading, Text, VStack, UnorderedList, ListItem, Link } from '@chakra-ui/react';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | Factrail',
  description: 'Factrail のプライバシーポリシー',
};

// 最終更新日: 内容を変更したときは必ず更新する
const LAST_UPDATED = '2026年9月2日';

export default function PrivacyPage() {
  return (
    <Box bg="bg.canvas" minH="100vh" py={{ base: 8, md: 16 }}>
      <Container maxW="3xl">
        <VStack spacing={8} align="stretch">
          <VStack spacing={2} align="stretch">
            <Heading as="h1" size="lg" color="text.default">
              プライバシーポリシー
            </Heading>
            <Text fontSize="sm" color="text.muted">
              最終更新日: {LAST_UPDATED}
            </Text>
          </VStack>

          <Section title="1. 本サービスについて">
            <Text>
              Factrail（以下「本サービス」）は、袖山直人（個人）が開発・運営している個人用のツールです。
              運営者が自身の活動記録を集めて振り返ることを目的としており、第三者に向けてサービスを提供する
              目的では運用していません。法人による運営ではなく、商用サービスでもありません。
            </Text>
          </Section>

          <Section title="2. 取得する情報">
            <Text mb={3}>本サービスは、利用者が連携を許可した範囲で以下の情報を取得します。</Text>
            <UnorderedList spacing={2}>
              <ListItem>
                <Text as="span" fontWeight="500">アカウント情報</Text>
                ：ログインに使用するメールアドレス、表示名。GitHub・Google のアカウントでログインした場合は、
                各サービスから提供されるアカウント識別子とメールアドレス。
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="500">活動記録（Fact）</Text>
                ：連携したサービスで発生した出来事の記録。現在の取得元は GitHub（Issue・Pull Request・
                コミット等）、Slack（メッセージ）、および運営者自身の環境から送信される記録
                （ブラウザの閲覧履歴、開発ツールの実行履歴、手動で入力したメモ等）です。
              </ListItem>
              <ListItem>
                <Text as="span" fontWeight="500">認証情報</Text>
                ：外部サービスとの連携に使用する OAuth のアクセストークン・リフレッシュトークン、
                および有効期限・スコープ。
              </ListItem>
            </UnorderedList>
          </Section>

          <Section title="3. 利用目的">
            <Text>
              取得した情報は、活動記録を収集・保存し、本サービスの画面上で時系列に閲覧できるようにするため
              にのみ利用します。広告配信や行動ターゲティングには利用しません。
            </Text>
          </Section>

          <Section title="4. 情報の保管と安全管理">
            <UnorderedList spacing={2}>
              <ListItem>
                データは運営者が管理する日本国内のサーバー上の PostgreSQL データベースに保存しています。
              </ListItem>
              <ListItem>
                OAuth のアクセストークン・リフレッシュトークン、および Webhook シークレット等の秘密情報は、
                <Text as="span" fontWeight="500"> AES-256-GCM で暗号化</Text>
                したうえで保存しています。平文では保存しません。
              </ListItem>
              <ListItem>通信は HTTPS で暗号化しています。</ListItem>
              <ListItem>本サービスの画面はログインした利用者本人のみが閲覧できます。</ListItem>
            </UnorderedList>
          </Section>

          <Section title="5. 第三者への提供">
            <Text>
              取得した情報を第三者に提供・販売することはありません。また、本サービスは利用者の情報を
              広告事業者やデータ分析事業者に渡すことはありません。連携先サービス（GitHub・Slack・Google）
              との通信は、利用者が許可した連携を実現するためにのみ行います。
            </Text>
          </Section>

          <Section title="6. Google ユーザーデータの取り扱い">
            <Text>
              Google アカウントでのログインを利用した場合、本サービスは本人確認のために Google から
              提供される基本的なプロフィール情報（アカウント識別子・メールアドレス・表示名）のみを取得します。
              取得した Google ユーザーデータは、本サービスへのログインおよび利用者本人への活動記録の表示
              のためにのみ使用し、第三者へ提供することはありません。また、これらのデータを広告目的や
              人手による内容の閲覧のために使用することはありません。
            </Text>
          </Section>

          <Section title="7. データの保存期間と削除">
            <Text>
              活動記録は、利用者が削除を希望するまで保存します。アカウントおよび保存されたデータの削除を
              希望する場合は、下記の連絡先までご連絡ください。連携の解除は、各外部サービス側の設定画面
              からも行えます。
            </Text>
          </Section>

          <Section title="8. Cookie 等の利用">
            <Text>
              本サービスはログイン状態を維持するためにブラウザのストレージおよび Cookie を使用します。
              アクセス解析ツールや広告用のトラッキングは使用していません。
            </Text>
          </Section>

          <Section title="9. 本ポリシーの変更">
            <Text>
              本ポリシーの内容は必要に応じて変更することがあります。変更した場合は、本ページの最終更新日を
              更新します。
            </Text>
          </Section>

          <Section title="10. お問い合わせ">
            <Text>
              本サービスおよび本ポリシーに関するお問い合わせは、以下までご連絡ください。
            </Text>
            <Text mt={2}>
              運営者: 袖山直人（個人）
              <br />
              連絡先:{' '}
              <Link href="mailto:sodeyama0417@gmail.com" color="accent.default" textDecoration="underline">
                sodeyama0417@gmail.com
              </Link>
            </Text>
          </Section>

          <Box pt={4} borderTopWidth="1px" borderColor="border.muted">
            <Link href="/terms" color="accent.default" fontSize="sm" textDecoration="underline">
              利用規約
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
