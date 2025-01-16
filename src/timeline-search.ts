import { TweetSearchRecentV2Paginator } from 'twitter-api-v2';
import { Profile, parseProfile } from './profile';
import { QueryProfilesResponse, QueryTweetsResponse } from './timeline-v1';
import { SearchEntryRaw, parseLegacyTweet } from './timeline-v2';
import { Tweet } from './tweets';

export interface SearchTimeline {
  data?: {
    search_by_raw_query?: {
      search_timeline?: {
        timeline?: {
          instructions?: {
            entries?: SearchEntryRaw[];
            entry?: SearchEntryRaw;
            type?: string;
          }[];
        };
      };
    };
  };
}

export function parseSearchTimelineTweets(
  timeline: SearchTimeline,
): QueryTweetsResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const tweets: Tweet[] = [];
  const instructions =
    timeline.data?.search_by_raw_query?.search_timeline?.timeline
      ?.instructions ?? [];
  for (const instruction of instructions) {
    if (
      instruction.type === 'TimelineAddEntries' ||
      instruction.type === 'TimelineReplaceEntry'
    ) {
      if (instruction.entry?.content?.cursorType === 'Bottom') {
        bottomCursor = instruction.entry.content.value;
        continue;
      } else if (instruction.entry?.content?.cursorType === 'Top') {
        topCursor = instruction.entry.content.value;
        continue;
      }

      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.tweetDisplayType === 'Tweet') {
          const tweetResultRaw = itemContent.tweet_results?.result;
          const tweetResult = parseLegacyTweet(
            tweetResultRaw?.core?.user_results?.result?.legacy,
            tweetResultRaw?.legacy,
          );

          if (tweetResult.success) {
            if (!tweetResult.tweet.views && tweetResultRaw?.views?.count) {
              const views = parseInt(tweetResultRaw.views.count);
              if (!isNaN(views)) {
                tweetResult.tweet.views = views;
              }
            }

            tweets.push(tweetResult.tweet);
          }
        } else if (entry.content?.cursorType === 'Bottom') {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === 'Top') {
          topCursor = entry.content.value;
        }
      }
    }
  }

  return { tweets, next: bottomCursor, previous: topCursor };
}

export function parseSearchTimelineTweetsV2(
  timeline: TweetSearchRecentV2Paginator,
): QueryTweetsResponse {
  let topCursor: string | undefined;
  const bottomCursor = timeline.meta.next_token;
  const tweets: Tweet[] = [];

  for (const unprocessedTweet of timeline.data.data) {
    const tweet: Tweet = {
      id: unprocessedTweet.id,
      bookmarkCount: undefined,
      conversationId: unprocessedTweet.conversation_id,
      hashtags:
        unprocessedTweet.entities?.hashtags?.map((hashtag) => hashtag.tag) || [],
      likes: unprocessedTweet.public_metrics?.like_count,
      mentions:
        unprocessedTweet.entities?.mentions?.map((mention) => ({
          id: mention.id,
          username: mention.username,
          name: mention.username,
        })) || [],
      name: unprocessedTweet.author_id,
      permanentUrl: `https://twitter.com/i/web/status/${unprocessedTweet.id}`,
      replies: unprocessedTweet.public_metrics?.reply_count,
      retweets: unprocessedTweet.public_metrics?.retweet_count,
      text: unprocessedTweet.text,
      thread: [],
      urls: unprocessedTweet.entities?.urls?.map((url) => url.url) || [],
      userId: unprocessedTweet.author_id,
      username: unprocessedTweet.author_id,
      videos: [],
      photos: [],
      isQuoted: false,
      isReply: false,
      isRetweet: false,
      isPin: false,
    };

    const quotedStatusIdStr = unprocessedTweet.referenced_tweets?.find(
      (tweet) => tweet.type === 'quoted',
    )?.id;
    const inReplyToStatusIdStr = unprocessedTweet.referenced_tweets?.find(
      (tweet) => tweet.type === 'replied_to',
    )?.id;
    const retweetedStatusIdStr = unprocessedTweet.referenced_tweets?.find(
      (tweet) => tweet.type === 'retweeted',
    )?.id;

    if (quotedStatusIdStr) {
      tweet.isQuoted = true;
      tweet.quotedStatusId = quotedStatusIdStr;
    }

    if (inReplyToStatusIdStr) {
      tweet.isReply = true;
      tweet.inReplyToStatusId = inReplyToStatusIdStr;
    }

    if (retweetedStatusIdStr) {
      tweet.isRetweet = true;
      tweet.retweetedStatusId = retweetedStatusIdStr;
    }

    tweets.push(tweet);
  }

  return { tweets, next: bottomCursor, previous: topCursor };
}

export function parseSearchTimelineUsers(
  timeline: SearchTimeline,
): QueryProfilesResponse {
  let bottomCursor: string | undefined;
  let topCursor: string | undefined;
  const profiles: Profile[] = [];
  const instructions =
    timeline.data?.search_by_raw_query?.search_timeline?.timeline
      ?.instructions ?? [];

  for (const instruction of instructions) {
    if (
      instruction.type === 'TimelineAddEntries' ||
      instruction.type === 'TimelineReplaceEntry'
    ) {
      if (instruction.entry?.content?.cursorType === 'Bottom') {
        bottomCursor = instruction.entry.content.value;
        continue;
      } else if (instruction.entry?.content?.cursorType === 'Top') {
        topCursor = instruction.entry.content.value;
        continue;
      }

      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.userDisplayType === 'User') {
          const userResultRaw = itemContent.user_results?.result;

          if (userResultRaw?.legacy) {
            const profile = parseProfile(
              userResultRaw.legacy,
              userResultRaw.is_blue_verified,
            );

            if (!profile.userId) {
              profile.userId = userResultRaw.rest_id;
            }

            profiles.push(profile);
          }
        } else if (entry.content?.cursorType === 'Bottom') {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === 'Top') {
          topCursor = entry.content.value;
        }
      }
    }
  }

  return { profiles, next: bottomCursor, previous: topCursor };
}
