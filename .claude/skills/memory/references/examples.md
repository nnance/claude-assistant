# Memory Extraction Examples

## Example 1: Decision Made

**User message**: "Let's go with Redis for the caching layer. It'll be easier to manage than Memcached."
**Agent response**: "Got it, I'll set up the Redis integration..."

**Extracted**:
```markdown
## 14:23:15 | #engineering
- **Type**: decision
- **Context**: Chose Redis over Memcached for the caching layer due to easier management.
```

## Example 2: New Person Mentioned

**User message**: "Can you check the calendar for my meeting with Dr. Patel? She's the new CTO at Acme Corp."
**Agent response**: "I found a meeting with Dr. Patel scheduled for..."

**Extracted**:
```markdown
## 09:45:00 | #general
- **Type**: entity
- **Context**: Dr. Patel is the new CTO at Acme Corp.
```

## Example 3: Action Item

**User message**: "Remind me — I need to submit the Q1 budget report to finance by March 1st."
**Agent response**: "Noted. The Q1 budget report is due to finance by March 1st..."

**Extracted**:
```markdown
## 11:02:30 | #dm
- **Type**: task
- **Context**: Nick needs to submit the Q1 budget report to finance by March 1st.
```

## Example 4: User Preference

**User message**: "Actually, can you always format code examples in TypeScript instead of JavaScript? I find it more readable."
**Agent response**: "Sure, I'll use TypeScript for code examples going forward."

**Extracted**:
```markdown
## 16:10:45 | #dm
- **Type**: preference
- **Context**: User prefers code examples in TypeScript instead of JavaScript.
```

## Example 5: Nothing to Extract

**User message**: "Thanks!"
**Agent response**: "You're welcome! Let me know if you need anything else."

**Extracted**: Nothing — this is a transactional exchange with no extractable information.

## Example 6: Multiple Items

**User message**: "The deploy went well. We're switching the staging environment to us-west-2 next week. Oh, and tell Sarah to review the PR when she's back."
**Agent response**: "Great to hear the deploy went well..."

**Extracted**:
```markdown
## 13:55:20 | #devops
- **Type**: fact
- **Context**: Staging environment is moving to us-west-2 region next week.

## 13:55:20 | #devops
- **Type**: task
- **Context**: Sarah needs to review the PR when she's back.
```
