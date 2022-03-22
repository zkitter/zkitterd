export const replyModerationClause = `
(
    (thrdmod.subtype = 'THREAD_HIDE_BLOCK' AND modblocked."messageId" IS NULL AND modblockeduser."messageId" IS NULL)
    OR (
        (thrdmod.subtype = 'THREAD_SHOW_FOLLOW') 
        AND (modliked."messageId" IS NOT NULL OR modfolloweduser."messageId" IS NOT NULL)
        AND modblocked."messageId" IS NULL AND modblockeduser."messageId" IS NULL
    )
    OR (
        (thrdmod.subtype = 'THREAD_ONLY_MENTION') 
        AND modblocked."messageId" IS NULL
        AND (
            modliked."messageId" IS NOT NULL
            OR p.creator IN (select REPLACE(tag_name, '@', '') from tags WHERE message_id = root."messageId")
        )
    )
    OR root.creator = p.creator
    OR thrdmod.subtype IS NULL
)
`;

export const notBlockedClause = `
(
    (blk."messageId" IS NULL AND rpblk."messageId" IS NULL) 
    AND p."creator" NOT IN (
        SELECT name FROM connections 
        WHERE name = p.creator 
        AND creator = '' 
        AND subtype = 'BLOCK'
    )
)
`;

export const globalModClause = `
(
    gmodblocked."messageId" IS NULL AND gmodblockeduser."messageId" IS NULL
)
`

export const globalVisibilityClause = `
(
    p.creator = '' OR global."messageId" IS NOT NULL
)
`