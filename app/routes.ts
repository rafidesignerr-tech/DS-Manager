import { type RouteConfig, index, route, prefix } from "@react-router/dev/routes";

export default [
  // Public
  index("routes/home.tsx"),
  route("foundations", "routes/foundations.tsx"),
  route("foundations/updates", "routes/foundations.updates.tsx"),
  route("foundations/track", "routes/foundations.track.ts"),
  route("foundations/token/:id", "routes/foundations.token.$id.tsx"),
  route("foundations/:section", "routes/foundations.$section.tsx"),
  route("components", "routes/components.tsx"),
  route("components/:id", "routes/components.$id.tsx"),
  route("icons", "routes/icons.tsx"),
  route("product-kit", "routes/product-kit.tsx"),
  route("changelog", "routes/changelog.tsx"),
  route("changelog/:id", "routes/changelog.$id.tsx"),
  route("feedback", "routes/feedback.tsx"),

  // Account
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("invite/:token", "routes/invite.$token.tsx"),
  route("setup", "routes/setup.tsx"),
  route("api/auth/*", "routes/api.auth.$.ts"),
  route("media/avatars/:key", "routes/media.avatars.$key.ts"),

  // Workspace
  route("tasks", "routes/tasks.tsx"),
  route("tasks/new", "routes/tasks.new.tsx"),
  route("tasks/:id", "routes/tasks.$id.tsx"),
  route("notifications", "routes/notifications.tsx"),
  route("profile", "routes/profile.tsx"),

  // Management
  route("team", "routes/team.tsx"),
  ...prefix("manage", [
    route("feedback", "routes/manage.feedback.tsx"),
    route("feedback/:id", "routes/manage.feedback.$id.tsx"),
    route("changelog", "routes/manage.changelog.tsx"),
    route("changelog/new", "routes/manage.changelog.new.tsx"),
    route("changelog/:id/edit", "routes/manage.changelog.$id.edit.tsx"),
  ]),

  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
