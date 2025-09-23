import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

interface User {
  id: string
  name: string
  email: string
  photo: {
    url: string
  }
  photoUploaded: boolean
  admin: boolean
  favorite_team: {
    id: number
    name: string
    slug: string
    acronym: string
    players: any[]
    location: string
    image_url: string
    modified_at: number
    current_videogame: any
  }
  token: string
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Authentification avec votre API
          const loginResponse = await fetch("https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          })

          if (!loginResponse.ok) {
            return null
          }

          const loginData = await loginResponse.json()

          if (!loginData.authToken) {
            return null
          }

          // Récupérer les informations utilisateur avec le token
          const userResponse = await fetch("https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0/auth/me", {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${loginData.authToken}`
            }
          })

          if (!userResponse.ok) {
            return null
          }

          const userData = await userResponse.json()

          return {
            id: userData.id.toString(),
            name: userData.name,
            email: userData.email,
            image: userData.photo?.url || null,
            photoUploaded: userData.photoUploaded,
            admin: userData.admin,
            favorite_team: userData.favorite_team,
            token: loginData.authToken
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.photoUploaded = (user as any).photoUploaded
        token.admin = (user as any).admin
        token.favorite_team = (user as any).favorite_team
        token.accessToken = (user as any).token
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id = token.sub!
        ;(session.user as any).photoUploaded = token.photoUploaded
        ;(session.user as any).admin = token.admin
        ;(session.user as any).favorite_team = token.favorite_team
        ;(session as any).accessToken = token.accessToken
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}