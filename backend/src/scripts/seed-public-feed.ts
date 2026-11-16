// Seed script for SkillStreak Public Feed AI Micro-drills (1-10)
// Populates the 10 first AI micro-drills from Marknad's production packages
// into the database so the public explore feed ("Utforska") is populated
// and 100% deterministic from Day 1.
//
// Usage: `pnpm run seed:public-feed`
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dataSource from '../database/data-source';
import { Player } from '../players/entities/player.entity';
import { ParentalConsentStatus } from '../players/player-consent-status.enum';
import { TeamJoinStatus } from '../players/team-join-status.enum';
import { PlayerLocale } from '../common/locale/player-locale.enum';
import { Team } from '../teams/entities/team.entity';
import { Jurisdiction } from '../common/age/article8-age';
import {
  PublicSharingConsent,
  PublicSharingConsentStatus,
} from '../public-sharing/entities/public-sharing-consent.entity';
import {
  PublicClipReviewStatus,
  VideoClip,
  VideoClipStatus,
  VideoClipTaggingStatus,
} from '../video-clips/entities/video-clip.entity';
import {
  VideoClipTag,
  VideoClipTagValue,
} from '../video-clips/entities/video-clip-tag.entity';

// Team ID matching PUBLIC_SHARING_ENABLED_TEAM_IDS in k8s/configmap.yaml
export const PUBLIC_FEED_TEAM_ID = 'cd0ce417-300b-417a-aea4-8bfe1b4a58f4';
const PUBLIC_FEED_TEAM_NAME = 'Ackers Test';
const PUBLIC_FEED_INVITE_CODE = 'ACKERS-CONTENT';

// Base time for published_publicly_at: 2026-11-10 10:00:00 UTC
// Staggered by 1 minute per drill so order 1-10 is deterministic when sorted DESC
const BASE_PUBLISHED_TIME_MS = Date.parse('2026-11-10T10:00:00.000Z');

export interface PublicFeedDrillSeed {
  drill_id: string;
  title: string;
  category: string;
  difficulty: string;
  xp_points: number;
  sport_tag: string;
  age_band: string;
  screen_name: string;
  avatar_id: string;
  duration_seconds: number;
  safety_text_onscreen: string;
  safety_display_duration_seconds: number;
  equipment_min: string;
  equipment_home: string;
  tts_voice: string;
  tts_text: string;
  recraft_master_prompt: string;
}

export function mapDrillToTags(drill: {
  sport_tag: string;
  category: string;
}): VideoClipTagValue[] {
  const tags: VideoClipTagValue[] = [];
  const s = drill.sport_tag.toLowerCase();
  const c = drill.category.toLowerCase();

  if (s === 'innebandy' || s === 'fotboll' || s === 'basket') {
    if (
      c.includes('teknik') ||
      c.includes('snabbhet') ||
      c.includes('koordination') ||
      c.includes('spänst')
    ) {
      tags.push(VideoClipTagValue.STICKHANDLING);
    }
  }
  if (s === 'ishockey' || c.includes('skott')) {
    tags.push(VideoClipTagValue.SHOOTING);
  }
  if (c.includes('målvakt') || c.includes('malvakt')) {
    tags.push(VideoClipTagValue.GOALKEEPING);
  }
  if (
    s === 'fys' ||
    s === 'agility' ||
    s === 'badminton' ||
    c.includes('bål') ||
    c.includes('fys') ||
    c.includes('agility') ||
    c.includes('snabbhet') ||
    c.includes('reaktion')
  ) {
    if (!tags.includes(VideoClipTagValue.FITNESS_CONDITIONING)) {
      tags.push(VideoClipTagValue.FITNESS_CONDITIONING);
    }
  }
  if (tags.length === 0) {
    tags.push(VideoClipTagValue.OTHER_TRAINING);
  }
  return tags;
}

export function loadPublicFeedDrills(): PublicFeedDrillSeed[] {
  const jsonPath = join(
    __dirname,
    '..',
    'video-clips',
    'data',
    'public-feed-drills.json',
  );
  const raw = readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw) as PublicFeedDrillSeed[];
}

export async function run(): Promise<void> {
  console.log('--- Initializing database connection for Public Feed seed ---');
  await dataSource.initialize();

  const teamRepo = dataSource.getRepository(Team);
  const playerRepo = dataSource.getRepository(Player);
  const consentRepo = dataSource.getRepository(PublicSharingConsent);
  const clipRepo = dataSource.getRepository(VideoClip);
  const tagRepo = dataSource.getRepository(VideoClipTag);

  // 1. Ensure content team exists
  let team =
    (await teamRepo.findOne({ where: { id: PUBLIC_FEED_TEAM_ID } })) ??
    (await teamRepo.findOne({ where: { inviteCode: PUBLIC_FEED_INVITE_CODE } }));

  if (!team) {
    team = await teamRepo.save(
      teamRepo.create({
        id: PUBLIC_FEED_TEAM_ID,
        name: PUBLIC_FEED_TEAM_NAME,
        inviteCode: PUBLIC_FEED_INVITE_CODE,
        jurisdiction: Jurisdiction.SE,
      }),
    );
    console.log(`Created content team ${team.id} (${team.name})`);
  } else {
    console.log(`Using existing content team ${team.id} (${team.name})`);
  }

  const drills = loadPublicFeedDrills();
  console.log(`Loaded ${drills.length} public feed drills to seed.`);

  for (let index = 0; index < drills.length; index++) {
    const drill = drills[index];
    const orderNum = index + 1;

    // 2. Ensure mascot player exists
    let player = await playerRepo.findOne({
      where: { teamId: team.id, screenName: drill.screen_name },
    });

    const birthYear = drill.age_band === '9-11' ? 2015 : 2013;

    if (!player) {
      player = await playerRepo.save(
        playerRepo.create({
          teamId: team.id,
          screenName: drill.screen_name,
          avatarId: drill.avatar_id,
          birthYear,
          jurisdiction: Jurisdiction.SE,
          parentalConsentStatus: ParentalConsentStatus.APPROVED,
          teamJoinStatus: TeamJoinStatus.APPROVED,
          locale: PlayerLocale.SV,
          isCaptain: false,
        }),
      );
      console.log(
        `[${orderNum}/10] Created player ${player.screenName} (${player.id}) [avatar=${player.avatarId}]`,
      );
    } else {
      let updated = false;
      if (player.parentalConsentStatus !== ParentalConsentStatus.APPROVED) {
        player.parentalConsentStatus = ParentalConsentStatus.APPROVED;
        updated = true;
      }
      if (player.teamJoinStatus !== TeamJoinStatus.APPROVED) {
        player.teamJoinStatus = TeamJoinStatus.APPROVED;
        updated = true;
      }
      if (player.avatarId !== drill.avatar_id) {
        player.avatarId = drill.avatar_id;
        updated = true;
      }
      if (updated) {
        await playerRepo.save(player);
        console.log(`[${orderNum}/10] Updated player ${player.screenName} (${player.id})`);
      } else {
        console.log(`[${orderNum}/10] Player ${player.screenName} (${player.id}) already valid`);
      }
    }

    // 3. Ensure active public-sharing consent
    let consent = await consentRepo.findOne({
      where: { playerId: player.id },
    });

    if (!consent) {
      consent = await consentRepo.save(
        consentRepo.create({
          playerId: player.id,
          status: PublicSharingConsentStatus.ACTIVE,
        }),
      );
      console.log(`  -> Created active PublicSharingConsent for ${player.screenName}`);
    } else if (consent.status !== PublicSharingConsentStatus.ACTIVE) {
      consent.status = PublicSharingConsentStatus.ACTIVE;
      await consentRepo.save(consent);
      console.log(`  -> Activated PublicSharingConsent for ${player.screenName}`);
    }

    // 4. Ensure video clip exists and is published + approved
    const storageKey = `clips/${team.id}/${drill.drill_id}.published-seed.mp4`;
    const publishedAt = new Date(BASE_PUBLISHED_TIME_MS - index * 60 * 1000);
    const caption = drill.title.slice(0, 140);

    let clip = await clipRepo.findOne({ where: { storageKey } });
    if (!clip) {
      clip = await clipRepo.save(
        clipRepo.create({
          teamId: team.id,
          uploaderPlayerId: player.id,
          storageKey,
          mimeType: 'video/mp4',
          fileSizeBytes: 5242880, // 5 MB representative payload
          durationSeconds: drill.duration_seconds,
          caption,
          status: VideoClipStatus.PUBLISHED,
          publishedPubliclyAt: publishedAt,
          publicReviewStatus: PublicClipReviewStatus.APPROVED,
          publicReviewedAt: new Date(BASE_PUBLISHED_TIME_MS),
          taggingStatus: VideoClipTaggingStatus.TAGGED,
          taggingAttempts: 1,
        }),
      );
      console.log(
        `  -> Created VideoClip ${clip.id} (${drill.drill_id}) [duration=${drill.duration_seconds}s, publishedAt=${publishedAt.toISOString()}]`,
      );
    } else {
      clip.status = VideoClipStatus.PUBLISHED;
      clip.publicReviewStatus = PublicClipReviewStatus.APPROVED;
      clip.publicReviewedAt = new Date(BASE_PUBLISHED_TIME_MS);
      clip.publishedPubliclyAt = publishedAt;
      clip.durationSeconds = drill.duration_seconds;
      clip.caption = caption;
      clip.taggingStatus = VideoClipTaggingStatus.TAGGED;
      await clipRepo.save(clip);
      console.log(`  -> Updated VideoClip ${clip.id} (${drill.drill_id})`);
    }

    // 5. Ensure tags are created
    const expectedTags = mapDrillToTags(drill);
    for (const tagValue of expectedTags) {
      const existingTag = await tagRepo.findOne({
        where: { clipId: clip.id, tag: tagValue },
      });
      if (!existingTag) {
        await tagRepo.save(
          tagRepo.create({
            clipId: clip.id,
            tag: tagValue,
            confidence: 1.0,
            source: 'ai_seed_v1',
          }),
        );
        console.log(`     + Added tag '${tagValue}' to clip ${clip.id}`);
      }
    }
  }

  console.log('\n--- Public Feed seeding completed successfully! ---');
  await dataSource.destroy();
}

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error('Public Feed seeding failed:', error);
    process.exitCode = 1;
  });
}
