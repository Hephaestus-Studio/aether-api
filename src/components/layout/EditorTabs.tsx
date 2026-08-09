import {
  Box,
  ScrollArea,
  Group,
  Text,
  Menu,
  CloseButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand } from "@tabler/icons-react";
import { useTabStore } from "@/stores/tabStore";
import classes from "./EditorTabs.module.css";

export default function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs } = useTabStore();
  const responsePanelOpened = useTabStore((s) => s.responsePanelOpened);
  const toggleResponsePanel = useTabStore((s) => s.toggleResponsePanel);

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET":
        return "var(--color-get)";
      case "POST":
        return "var(--color-post)";
      case "PUT":
        return "var(--color-put)";
      case "PATCH":
        return "var(--color-patch)";
      case "DELETE":
        return "var(--color-delete)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <Box className={classes.tabBar}>
      <ScrollArea className={classes.scrollArea} scrollbars="x">
        <Group gap={0} wrap="nowrap" className={classes.tabGroup}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <Menu key={tab.id} position="bottom-start" withinPortal>
                <Menu.ContextMenu>
                  <Box
                    onClick={() => setActiveTab(tab.id)}
                    className={`${classes.tab} ${isActive ? classes.tabActive : ""}`}
                  >
                    <Text
                      size="xs"
                      fw={700}
                      style={{ color: getMethodColor(tab.method) }}
                      className={classes.methodText}
                    >
                      {tab.method}
                    </Text>
                    <Text size="xs" className={classes.nameText} truncate>
                      {tab.name}
                    </Text>
                    {tab.isDirty && <Box className={classes.dirtyMarker} />}
                    <CloseButton
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className={classes.closeBtn}
                    />
                  </Box>
                </Menu.ContextMenu>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => closeTab(tab.id)}>Close Tab</Menu.Item>
                  <Menu.Item onClick={() => closeOtherTabs(tab.id)}>Close Others</Menu.Item>
                  <Menu.Item onClick={() => closeAllTabs()}>Close All</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            );
          })}
        </Group>
      </ScrollArea>
      {tabs.length > 0 && (
        <Group gap={6} px="xs" className={classes.actionsGroup}>
          <Tooltip
            label={responsePanelOpened ? "Hide Response Panel" : "Show Response Panel"}
            position="bottom-end"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              onClick={toggleResponsePanel}
              className={classes.actionBtn}
            >
              {responsePanelOpened ? (
                <IconLayoutSidebarRightCollapse size={16} />
              ) : (
                <IconLayoutSidebarRightExpand size={16} />
              )}
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </Box>
  );
}
