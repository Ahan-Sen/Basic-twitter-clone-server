import { permissions } from './permissions'
import { APP_SECRET, getUserId } from './utils'
import { compare, hash } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { applyMiddleware } from 'graphql-middleware'
import {
  intArg,
  makeSchema,
  nonNull,
  objectType,
  stringArg,
  inputObjectType,
  arg,
  asNexusMethod,
  enumType,
} from 'nexus'
import { DateTimeResolver } from 'graphql-scalars'
import { Context } from './context'
import { resolve } from 'path'

export const DateTime = asNexusMethod(DateTimeResolver, 'date')

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('allUsers', {
      type: 'User',
      resolve: (_parent, _args, context: Context) => {
        return context.prisma.user.findMany()
      },
    })

    t.nullable.field('me', {
      type: 'User',
      resolve: (_parent, _args, context: Context) => {
        const userId = getUserId(context)
        return context.prisma.user.findUnique({
          where: {
            id: Number(userId),
          },
        })
      },
    })

    t.list.field('tweets', {
      type: 'Tweet',
      resolve: (_parent, _args, context: Context) => {
        return context.prisma.tweet.findMany()
      },
    })

    t.field("tweet", {
      type: "Tweet",
      args: { id: intArg() },
      resolve: (_parent, { id }, context: Context) => {
        return context.prisma.tweet.findUnique({
          where: {
            id: Number(id)
          }
        })
      }
    })
    t.field("user", {
      type: "User",
      args: { id: intArg() },
      resolve: (_parent, { id }, ctx) => {
        return ctx.prisma.user.findUnique({
          where: {
            id: Number(id)
          }
        })
      }
    })

    t.list.field("followers", {
      type: "Following",
      args: { id: intArg() },
      resolve: (_parent, { id }, ctx:Context) => {
        
        return ctx.prisma.following.findMany({
          where: {
            followId: Number(id)
          }
        })
      }
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('signup', {
      type: 'AuthPayload',
      args: {
        name: stringArg(),
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve: async (_parent, args, context: Context) => {
        const userexist = await context.prisma.user.findUnique({
          where: {
            email: args.email,
          },
        })
        if (userexist) {
          return new Error('User already exists')
        }
        const nameexist = await context.prisma.user.findUnique({
          where: {
            name: args.name,
          },
        })
        
        if (nameexist) {
          return new Error('This name is already taken')
        }
        

        const hashedPassword = await hash(args.password, 10)
        const user = await context.prisma.user.create({
          data: {
            name: args.name,
            email: args.email,
            password: hashedPassword,
          },
        })
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })

    t.field('login', {
      type: 'AuthPayload',
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve: async (_parent, { email, password }, context: Context) => {
        const user = await context.prisma.user.findUnique({
          where: {
            email,
          },
        })
        
        if (user == null) {
          return new Error('Invalid email or password')
        }
        const passwordValid = await compare(password, user.password)
        if (!passwordValid) {
          return new Error('Invalid email or password')
        }
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })

    t.field('createProfile', {
      type: 'Profile',
      args: {
        bio: stringArg(),
        location: stringArg(),
        website: stringArg(),
        avatar: stringArg(),
      },
      resolve: (_parents, args, context: Context) => {
        const userId = getUserId(context)
        if (!userId) return new Error('Could not authenticate user')
        return context.prisma.profile.create({
          data: {
            ...args,
            // connects an existing user of id - userId
            User: { connect: { id: Number(userId) } },
          },
        })
      },
    }),
      t.field('updateProfile', {
        type: 'Profile',
        args: {
          id: intArg(),
          bio: stringArg(),
          location: stringArg(),
          website: stringArg(),
          avatar: stringArg(),
        },
        resolve: (_parent, { id, ...args }, context: Context) => {
          const userId = getUserId(context)
          if (!userId) return new Error('Could not authenticate user.')

          return context.prisma.profile.update({
            data: {
              ...args,
            },
            where: {
              userId: Number(id),
            },
          })
        },
      }),
      t.field('createTweet', {
        type: 'Tweet',
        args: {
          content: stringArg(),
        },
        resolve: (_parent, { content }, context: Context) => {
          const userId = getUserId(context)
          if (!userId) return new Error('Could not authenticate user.')
          return context.prisma.tweet.create({
            data: {
              content,
              author: { connect: { id: Number(userId) } },
            },
          })
        },
      }),
      t.field("likeTweet", {
        type: "LikedTweet",
        args: {
          id: intArg()
        },
        resolve: (_parent, { id }, context: Context) => {
          const userId = getUserId(context)
          if (!userId) return new Error("Could not authenticate user.")
          return context.prisma.likedTweet.create({
            data: {
              tweet: { connect: { id: Number(id) } },
              User: { connect: { id: Number(userId) } }
            }
          })
        }
      }),
      t.field("deleteLike", {
        type: "LikedTweet",
        args: {
          id: intArg()
        },
        resolve: (_parent, { id }, context: Context) => {
          const userId = getUserId(context)
          if (!userId) return new Error("Could not authenticate user.")
          return context.prisma.likedTweet.delete({
            where: { id: id }
          })
        }
      })

      t.field("deleteTweet", {
        type: "Tweet",
        args: {
          id: intArg()
        },
        resolve: (_parent, { id }, context: Context) => {
          const userId = getUserId(context)
          if (!userId) return new Error("Could not authenticate user.")
          return context.prisma.tweet.delete({
            where: { id: id }
          })
        }
      })

    t.field("createComment", {
      type: "Comments",
      args: {
        content: stringArg(),
        id: intArg()
      },
      resolve: (_parent, { content, id }, context: Context) => {
        const userId = getUserId(context)
        if (!userId) return new Error("Could not authenticate user.")
        return context.prisma.comment.create({
          data: {
            content,
            User: { connect: { id: Number(userId) } },
            Tweet: { connect: { id: Number(id) } }
          }
        })
      }
    })

    t.field("deleteComment", {
      type: "Comments",
      args: {
        id: intArg()
      },
      resolve: (_parent, { id }, context: Context) => {
        const userId = getUserId(context)
        if (!userId) return new Error("Could not authenticate user.")
        return context.prisma.comment.delete({
          where: { id: id }
        })
      }
    })

    t.field("createReply", {
      type: "Comments",
      args: {
        content: stringArg(),
        id: intArg(),
        commentId: intArg()
      },
      resolve: (_parent, { content, id, commentId }, ctx) => {
        const userId = getUserId(ctx)
        if (!userId) return new Error("Could not authenticate user.")
        return ctx.prisma.comment.create({
          data: {
            content,
            User: { connect: { id: Number(userId) } },
            Tweet: { connect: { id: Number(id) } },
            Comment: { connect: { id: Number(commentId) } }
          }
        })
      }
    })
    t.field("follow", {
      type: "Following",
      args: {
        name: stringArg(),
        followId: intArg(),
        avatar: stringArg()
      },
      resolve: (_parent, { name, followId, avatar }: any, context: Context) => {
        const userId = getUserId(context)
        if (!userId) return new Error("Could not authenticate user.")
        return context.prisma.following.create({
          data: {
            name,
            avatar,
            followId,
            User: { connect: { id: Number(userId) } }
          }
        })
      }
    })
    t.field("deleteFollow", {
      type: "Following",
      args: {
        id: intArg()
      },
      resolve: (_parent, { id }, context) => {
        const userId = getUserId(context)
        if (!userId) return new Error("Could not authenticate user.")
        return context.prisma.following.delete({
          where: { id: id }
        })
      }
    })
  }
})


const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('name')
    t.nonNull.string('email')
    t.field('profile', {
      type: 'Profile',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id },
          })
          .Profile()
      },
    })
    t.nonNull.list.nonNull.field('tweets', {
      type: 'Tweet',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .Tweet()
      },
    })
    t.list.field('likedTweet', {
      type: LikedTweet,
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .likedTweet()
      },
    })
    t.list.field('comments', {
      type: Comments,
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .comments()
      },
    })
    t.list.field('Following', {
      type: Following,
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .Following()
      },
    })
  },
})

const Profile = objectType({
  name: 'Profile',
  definition(t) {
    t.nonNull.int('id')
    t.string('bio')
    t.string('location')
    t.string('website')
    t.string('avatar')
    t.field('user', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.profile
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .User()
      },
    })
  },
})

export const Tweet = objectType({
  name: 'Tweet',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('content')
    t.date('createdAt')
    t.field('author', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.tweet
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .author()
      },
    })
    t.list.field('likes', {
      type: 'LikedTweet',
      resolve: (parent, _, context: Context) => {
        return context.prisma.tweet
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .likes()
      },
    })
    t.list.field('comments', {
      type: 'Comments',
      resolve: (parent, _, context: Context) => {
        return context.prisma.tweet
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .comments()
      },
    })
  },
})

const LikedTweet = objectType({
  name: 'LikedTweet',
  definition(t) {
    t.nonNull.int('id')
    t.date('likedAt')
    t.nonNull.field('tweet', {
      type: 'Tweet',
      resolve: (parent, _, context: Context) => {
        return context.prisma.tweet.findUnique({
          where: { id: parent.tweetId || undefined },
        })
      },
    })
    t.nonNull.field('User', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user.findUnique({
          where: { id: parent.userId || undefined },
        })
      },
    })
  },
})
const Following = objectType({
  name: 'Following',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('name')
    t.nonNull.int('followId')
    t.nullable.string('avatar')
    t.nonNull.field('User', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user.findUnique({
          where: { id: parent.userId || undefined },
        })
      },
    })
  },
})
const Comments = objectType({
  name: 'Comments',
  definition(t) {
    t.nonNull.int('id')
    t.date('createdAt')
    t.int('commentId')
    t.nonNull.string('content')
    t.nonNull.field('Tweet', {
      type: 'Tweet',
      resolve: (parent, _, context: Context) => {
        return context.prisma.tweet.findUnique({
          where: { id: parent.tweetId || undefined },
        })
      },
    })
    t.nonNull.field('User', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user.findUnique({
          where: { id: parent.userId || undefined },
        })
      },
    })
    t.list.field('comments', {
      type: Comments,
      resolve: (parent, _, context: Context) => {
        return context.prisma.comment.findUnique({
          where: { id: parent.commentId || undefined },
        })
      }
    })
  },
})

const SortOrder = enumType({
  name: 'SortOrder',
  members: ['asc', 'desc'],
})

const AuthPayload = objectType({
  name: 'AuthPayload',
  definition(t) {
    t.string('token')
    t.field('user', { type: 'User' })
  },
})

const schemaWithoutPermissions = makeSchema({
  types: [
    Query,
    Mutation,
    User,
    Profile,
    Tweet,
    LikedTweet,
    AuthPayload,
    SortOrder,
    DateTime,
    Comments,
    Following
  ],
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  sourceTypes: {
    modules: [
      {
        module: '@prisma/client',
        alias: 'prisma',
      },
    ],
  },
})

export const schema = applyMiddleware(schemaWithoutPermissions, permissions)
